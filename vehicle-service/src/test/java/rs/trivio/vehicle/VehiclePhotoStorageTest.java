package rs.trivio.vehicle;

import static org.junit.jupiter.api.Assertions.*;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.Arrays;
import java.util.zip.CRC32;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

class VehiclePhotoStorageTest {
    @TempDir Path temporary;
    private Path media;
    private VehiclePhotoStorage storage;

    @BeforeEach void setUp() {
        media = temporary.resolve("media");
        storage = new VehiclePhotoStorage(media.toString());
    }

    @Test void acceptsActualPngRegardlessOfClientFilenameAndMimeAndDiscardsTrailingContent() throws Exception {
        byte[] png = png(24, 16, true);
        byte[] marker = "<script>discard-original-metadata</script>".getBytes(StandardCharsets.US_ASCII);
        byte[] upload = Arrays.copyOf(png, png.length + marker.length);
        System.arraycopy(marker, 0, upload, png.length, marker.length);
        var stored = storage.store(new MockMultipartFile("file", "../../original.svg", "text/html", upload));

        assertTrue(VehiclePhotoStorage.isGeneratedFilename(stored.filename()));
        assertTrue(VehiclePhotoStorage.isGeneratedFilename(stored.thumbnailFilename()));
        assertFalse(stored.filename().contains("original"));
        byte[] output = storage.read(stored.filename());
        assertEquals((byte) 0xff, output[0]);
        assertEquals((byte) 0xd8, output[1]);
        assertFalse(new String(output, StandardCharsets.ISO_8859_1).contains("discard-original-metadata"));
        BufferedImage sanitized = ImageIO.read(new ByteArrayInputStream(output));
        assertEquals(24, sanitized.getWidth());
        assertEquals(16, sanitized.getHeight());
        assertFalse(sanitized.getColorModel().hasAlpha());
        Color background = new Color(sanitized.getRGB(12, 8));
        assertTrue(background.getRed() >= 250 && background.getGreen() >= 250 && background.getBlue() >= 250);
        try (var paths = Files.list(media)) { assertEquals(2, paths.count()); }
    }

    @Test void mainAndThumbnailFitTheirMaximumEdgeWithoutUpscaling() throws Exception {
        var stored = storage.store(new MockMultipartFile("files", "car.png", "image/png", png(2400, 1200, false)));
        BufferedImage main = ImageIO.read(new ByteArrayInputStream(storage.read(stored.filename())));
        BufferedImage thumb = ImageIO.read(new ByteArrayInputStream(storage.read(stored.thumbnailFilename())));
        assertEquals(1800, main.getWidth());
        assertEquals(900, main.getHeight());
        assertEquals(640, thumb.getWidth());
        assertEquals(320, thumb.getHeight());
    }

    @Test void acceptsJpegAndDoesNotUpscaleItsThumbnail() throws Exception {
        BufferedImage image = new BufferedImage(19, 27, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        assertTrue(ImageIO.write(image, "jpeg", bytes));
        var stored = storage.store(new MockMultipartFile("files", "renamed.png", "application/octet-stream", bytes.toByteArray()));
        BufferedImage thumbnail = ImageIO.read(new ByteArrayInputStream(storage.read(stored.thumbnailFilename())));
        assertEquals(19, thumbnail.getWidth());
        assertEquals(27, thumbnail.getHeight());
    }

    @Test void rejectsSpoofedMimeUnsupportedAndCorruptFilesWithoutCreatingTheDirectory() {
        for (byte[] bytes : new byte[][] {
            "<svg xmlns='http://www.w3.org/2000/svg'/>".getBytes(StandardCharsets.UTF_8),
            "GIF89a".getBytes(StandardCharsets.US_ASCII),
            "RIFF0000WEBP".getBytes(StandardCharsets.US_ASCII),
            new byte[]{(byte) 0xff, (byte) 0xd8, (byte) 0xff, 0, 0}
        }) {
            var error = assertThrows(ResponseStatusException.class,
                () -> storage.store(new MockMultipartFile("files", "car.jpg", "image/jpeg", bytes)));
            assertEquals(400, error.getStatusCode().value());
            assertFalse(Files.exists(media));
        }
    }

    @Test void rejectsEmptyAndOversizedUploads() {
        assertEquals(400, assertThrows(ResponseStatusException.class,
            () -> storage.store(new MockMultipartFile("files", new byte[0]))).getStatusCode().value());
        assertEquals(413, assertThrows(ResponseStatusException.class,
            () -> storage.store(new MockMultipartFile("files", new byte[VehiclePhotoStorage.MAX_FILE_BYTES + 1])))
            .getStatusCode().value());
        assertFalse(Files.exists(media));
    }

    @Test void boundsActualStreamEvenWhenDeclaredSizeLies() {
        var upload = new MockMultipartFile("files", new byte[VehiclePhotoStorage.MAX_FILE_BYTES + 1]) {
            @Override public long getSize() { return 1; }
        };
        assertEquals(413, assertThrows(ResponseStatusException.class, () -> storage.store(upload)).getStatusCode().value());
        assertFalse(Files.exists(media));
    }

    @Test void validatesDimensionsBeforeDecodingOversizedPixelData() throws Exception {
        byte[] excessiveDimensions = dimensions(png(2, 2, false), 5000, 5000);
        var error = assertThrows(ResponseStatusException.class,
            () -> storage.store(new MockMultipartFile("files", "large.png", "image/png", excessiveDimensions)));
        assertEquals(400, error.getStatusCode().value());
        assertTrue(error.getReason().contains("20 megapiksela"));
        assertFalse(Files.exists(media));
    }

    @Test void rejectsZeroDimensions() throws Exception {
        byte[] zeroDimensions = dimensions(png(2, 2, false), 0, 2);
        assertEquals(400, assertThrows(ResponseStatusException.class,
            () -> storage.store(new MockMultipartFile("files", "zero.png", "image/png", zeroDimensions)))
            .getStatusCode().value());
        assertFalse(Files.exists(media));
    }

    @Test void acceptsOnlyGeneratedBasenamesAndRejectsTraversal() {
        String id = "ff5e349b-965f-4d9d-9ceb-84d7565397fe";
        assertTrue(VehiclePhotoStorage.isGeneratedFilename(id + ".jpg"));
        assertTrue(VehiclePhotoStorage.isGeneratedFilename(id + "-thumb.jpg"));
        for (String name : new String[]{"../" + id + ".jpg", "sub/" + id + ".jpg", "C:\\" + id + ".jpg",
            id + ".png", id.toUpperCase() + ".jpg", id + ".jpg:secret", "not-a-uuid.jpg", ""}) {
            assertFalse(VehiclePhotoStorage.isGeneratedFilename(name));
            assertEquals(404, assertThrows(ResponseStatusException.class, () -> storage.read(name)).getStatusCode().value());
        }
        assertFalse(VehiclePhotoStorage.isGeneratedFilename(null));
    }

    @Test void deletionRemovesBothGeneratedFilesAndIsIdempotent() throws Exception {
        var stored = storage.store(new MockMultipartFile("file", png(8, 8, false)));
        storage.deleteQuietly(stored);
        storage.deleteQuietly(stored);
        try (var paths = Files.list(media)) { assertEquals(0, paths.count()); }
        assertEquals(404, assertThrows(ResponseStatusException.class, () -> storage.read(stored.filename())).getStatusCode().value());
    }

    @Test void refusesSymlinkRootWithoutWritingThroughIt() throws Exception {
        Path elsewhere = Files.createDirectory(temporary.resolve("elsewhere"));
        try { Files.createSymbolicLink(media, elsewhere); }
        catch (IOException | UnsupportedOperationException | SecurityException unavailable) {
            Assumptions.assumeTrue(false, "Symbolic links are unavailable for this operating system/account");
        }
        assertThrows(VehiclePhotoStorage.StorageFailure.class,
            () -> storage.store(new MockMultipartFile("file", png(8, 8, false))));
        try (var paths = Files.list(elsewhere)) { assertEquals(0, paths.count()); }
    }

    @Test void refusesSymlinkFileAndDoesNotDeleteItsTarget() throws Exception {
        Files.createDirectory(media);
        String filename = "ff5e349b-965f-4d9d-9ceb-84d7565397fe.jpg";
        Path outside = Files.writeString(temporary.resolve("outside.txt"), "untouched");
        try { Files.createSymbolicLink(media.resolve(filename), outside); }
        catch (IOException | UnsupportedOperationException | SecurityException unavailable) {
            Assumptions.assumeTrue(false, "Symbolic links are unavailable for this operating system/account");
        }
        assertThrows(VehiclePhotoStorage.StorageFailure.class, () -> storage.read(filename));
        storage.deleteQuietly(new VehiclePhotoStorage.StoredPhoto(filename, filename));
        assertEquals("untouched", Files.readString(outside));
    }

    private static byte[] png(int width, int height, boolean transparent) throws IOException {
        BufferedImage image = new BufferedImage(width, height, transparent ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        if (!ImageIO.write(image, "png", bytes)) throw new IOException("PNG encoder unavailable in test runtime");
        return bytes.toByteArray();
    }

    private static byte[] dimensions(byte[] png, int width, int height) {
        byte[] patched = png.clone();
        ByteBuffer.wrap(patched).putInt(16, width).putInt(20, height);
        CRC32 crc = new CRC32();
        crc.update(patched, 12, 17);
        ByteBuffer.wrap(patched).putInt(29, (int) crc.getValue());
        return patched;
    }
}
