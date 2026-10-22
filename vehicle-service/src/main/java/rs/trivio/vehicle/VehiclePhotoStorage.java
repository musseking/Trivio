package rs.trivio.vehicle;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.*;
import java.util.Iterator;
import java.util.UUID;
import java.util.regex.Pattern;
import javax.imageio.*;
import javax.imageio.stream.MemoryCacheImageInputStream;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/** The upload's MIME type, original name and metadata never become filesystem paths or output metadata. */
@Component
public class VehiclePhotoStorage {
    public static final int MAX_FILE_BYTES = 5 * 1024 * 1024;
    public static final long MAX_PIXELS = 20_000_000L;
    private static final int MAX_STORED_BYTES = 20 * 1024 * 1024;
    private static final Pattern GENERATED_NAME = Pattern.compile(
        "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:-thumb)?\\.jpg");
    private final Path directory;

    public record StoredPhoto(String filename, String thumbnailFilename) {}

    public static class StorageFailure extends RuntimeException {
        StorageFailure() { super("Photo storage is unavailable"); }
    }

    public VehiclePhotoStorage(@Value("${trivio.media.directory:./data/vehicle-media}") String directory) {
        this.directory = Path.of(directory).toAbsolutePath().normalize();
    }

    public static boolean isGeneratedFilename(String filename) {
        return filename != null && GENERATED_NAME.matcher(filename).matches();
    }

    public StoredPhoto store(MultipartFile file) {
        byte[] upload = uploadBytes(file);
        BufferedImage image = decode(upload);
        byte[] main;
        byte[] thumbnail;
        try {
            main = jpeg(image, 1800);
            thumbnail = jpeg(image, 640);
        } finally {
            image.flush();
        }
        String stem = UUID.randomUUID().toString();
        StoredPhoto stored = new StoredPhoto(stem + ".jpg", stem + "-thumb.jpg");
        boolean mainWritten = false;
        boolean thumbnailWritten = false;
        try {
            ensureDirectory();
            writeAtomically(stored.filename(), main);
            mainWritten = true;
            writeAtomically(stored.thumbnailFilename(), thumbnail);
            thumbnailWritten = true;
            return stored;
        } catch (IOException | RuntimeException error) {
            // Only remove files published by this call, even in the unlikely event of a UUID collision.
            deleteQuietly(new StoredPhoto(mainWritten ? stored.filename() : null,
                thumbnailWritten ? stored.thumbnailFilename() : null));
            throw new StorageFailure();
        }
    }

    public byte[] read(String filename) {
        if (!isGeneratedFilename(filename)) throw missing();
        try {
            Path path = safePath(filename);
            if (!Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)) throw missing();
            try (InputStream input = Files.newInputStream(path, LinkOption.NOFOLLOW_LINKS)) {
                byte[] bytes = input.readNBytes(MAX_STORED_BYTES + 1);
                if (bytes.length > MAX_STORED_BYTES) throw new StorageFailure();
                return bytes;
            }
        } catch (NoSuchFileException error) {
            throw missing();
        } catch (IOException | SecurityException error) {
            throw new StorageFailure();
        }
    }

    /** Used only after commit (old files) or rollback (new files); failures must not reverse database success. */
    public void deleteQuietly(StoredPhoto stored) {
        if (stored == null) return;
        for (String name : new String[]{stored.filename(), stored.thumbnailFilename()}) {
            try {
                if (isGeneratedFilename(name)) Files.deleteIfExists(safePath(name));
            } catch (IOException | SecurityException | StorageFailure ignored) {
                // An orphan is preferable to deleting outside the managed directory or losing committed metadata.
            }
        }
    }

    private byte[] uploadBytes(MultipartFile file) {
        if (file == null || file.isEmpty()) throw invalid("Dodajte JPEG ili PNG fotografiju.");
        if (file.getSize() > MAX_FILE_BYTES) throw tooLarge();
        try (InputStream input = file.getInputStream()) {
            byte[] bytes = input.readNBytes(MAX_FILE_BYTES + 1);
            if (bytes.length > MAX_FILE_BYTES) throw tooLarge();
            if (bytes.length == 0) throw invalid("Fotografija je prazna.");
            return bytes;
        } catch (IOException error) {
            throw invalid("Fotografiju nije moguće pročitati. Pokušajte ponovo.");
        }
    }

    private BufferedImage decode(byte[] bytes) {
        boolean png = bytes.length >= 8 && bytes[0] == (byte) 0x89 && bytes[1] == 0x50
            && bytes[2] == 0x4e && bytes[3] == 0x47 && bytes[4] == 0x0d && bytes[5] == 0x0a
            && bytes[6] == 0x1a && bytes[7] == 0x0a;
        boolean jpeg = bytes.length >= 3 && bytes[0] == (byte) 0xff
            && bytes[1] == (byte) 0xd8 && bytes[2] == (byte) 0xff;
        if (!png && !jpeg) throw invalid("Dozvoljene su samo ispravne JPEG i PNG fotografije.");
        try (MemoryCacheImageInputStream input = new MemoryCacheImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw invalid("Fotografija nije ispravan JPEG ili PNG fajl.");
            ImageReader reader = readers.next();
            try {
                String format = reader.getFormatName();
                if (!(png && "PNG".equalsIgnoreCase(format)
                    || jpeg && ("JPEG".equalsIgnoreCase(format) || "JPG".equalsIgnoreCase(format)))) {
                    throw invalid("Format fotografije nije podržan.");
                }
                reader.setInput(input, true, true);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width <= 0 || height <= 0 || (long) width * height > MAX_PIXELS)
                    throw invalid("Fotografija sme imati najviše 20 megapiksela.");
                BufferedImage image = reader.read(0);
                if (image == null || image.getWidth() != width || image.getHeight() != height)
                    throw invalid("Fotografija nije ispravna.");
                return image;
            } finally {
                reader.dispose();
            }
        } catch (ResponseStatusException error) {
            throw error;
        } catch (IOException | RuntimeException error) {
            throw invalid("Fotografija nije ispravna. Izaberite drugi JPEG ili PNG fajl.");
        }
    }

    private byte[] jpeg(BufferedImage source, int maxEdge) {
        double scale = Math.min(1d, (double) maxEdge / Math.max(source.getWidth(), source.getHeight()));
        int width = Math.max(1, (int) Math.round(source.getWidth() * scale));
        int height = Math.max(1, (int) Math.round(source.getHeight() * scale));
        BufferedImage sanitized = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = sanitized.createGraphics();
        try {
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, width, height);
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics.drawImage(source, 0, 0, width, height, null);
        } finally {
            graphics.dispose();
        }
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
        if (!writers.hasNext()) { sanitized.flush(); throw new StorageFailure(); }
        ImageWriter writer = writers.next();
        try (ByteArrayOutputStream bytes = new ByteArrayOutputStream();
             MemoryCacheImageOutputStream output = new MemoryCacheImageOutputStream(bytes)) {
            writer.setOutput(output);
            ImageWriteParam parameters = writer.getDefaultWriteParam();
            parameters.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            parameters.setCompressionQuality(.85f);
            writer.write(null, new IIOImage(sanitized, null, null), parameters);
            output.flush();
            return bytes.toByteArray();
        } catch (IOException | RuntimeException error) {
            throw new StorageFailure();
        } finally {
            writer.dispose();
            sanitized.flush();
        }
    }

    private void ensureDirectory() throws IOException {
        rejectSymlinks();
        Files.createDirectories(directory);
        rejectSymlinks();
        if (!Files.isDirectory(directory, LinkOption.NOFOLLOW_LINKS)) throw new StorageFailure();
    }

    private void rejectSymlinks() throws IOException {
        Path part = directory.getRoot();
        for (Path segment : directory) {
            part = part.resolve(segment);
            if (Files.isSymbolicLink(part)) throw new StorageFailure();
            // Real-path comparison also catches Windows directory junctions/reparse aliases.
            if (Files.exists(part, LinkOption.NOFOLLOW_LINKS) && !part.toRealPath().equals(part.toAbsolutePath().normalize()))
                throw new StorageFailure();
        }
    }

    private Path safePath(String filename) throws IOException {
        if (!isGeneratedFilename(filename)) throw new StorageFailure();
        rejectSymlinks();
        Path path = directory.resolve(filename).normalize();
        if (!path.getParent().equals(directory) || Files.isSymbolicLink(path)) throw new StorageFailure();
        return path;
    }

    private void writeAtomically(String filename, byte[] bytes) throws IOException {
        Path target = safePath(filename);
        if (Files.exists(target, LinkOption.NOFOLLOW_LINKS)) throw new StorageFailure();
        Path temporary = Files.createTempFile(directory, ".upload-", ".tmp");
        try {
            try (FileChannel channel = FileChannel.open(temporary, StandardOpenOption.WRITE,
                    StandardOpenOption.TRUNCATE_EXISTING, LinkOption.NOFOLLOW_LINKS)) {
                ByteBuffer buffer = ByteBuffer.wrap(bytes);
                while (buffer.hasRemaining()) channel.write(buffer);
                channel.force(true);
            }
            // Keep publication atomic; a filesystem without atomic moves must fail safely.
            safePath(filename);
            Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE);
        } finally {
            Files.deleteIfExists(temporary);
        }
    }

    private static ResponseStatusException invalid(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
    private static ResponseStatusException tooLarge() {
        return new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Fotografija sme imati najviše 5 MiB.");
    }
    private static ResponseStatusException missing() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Fotografija nije pronađena.");
    }
}
