package rs.trivio.auth;

import java.awt.Color;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.*;
import javax.imageio.*;
import javax.imageio.stream.MemoryCacheImageInputStream;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/** Decode bounded JPEG/PNG input and re-encode pixels only. Never retain the original or metadata. */
@Component
public class ProfilePhotoCodec {
    public static final int MAX_BYTES = 5 * 1024 * 1024;
    public static final int EDGE = 512;

    public byte[] sanitize(MultipartFile file) {
        if (file == null || file.isEmpty()) throw invalid();
        if (file.getSize() > MAX_BYTES) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE);
        try (var stream = file.getInputStream()) {
            byte[] bytes = stream.readNBytes(MAX_BYTES + 1);
            if (bytes.length > MAX_BYTES) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE);
            boolean png = bytes.length >= 8 && bytes[0] == (byte) 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4e
                && bytes[3] == 0x47 && bytes[4] == 0x0d && bytes[5] == 0x0a && bytes[6] == 0x1a && bytes[7] == 0x0a;
            boolean jpg = bytes.length >= 3 && bytes[0] == (byte) 0xff && bytes[1] == (byte) 0xd8 && bytes[2] == (byte) 0xff;
            if (!png && !jpg) throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
            try (var input = new MemoryCacheImageInputStream(new ByteArrayInputStream(bytes))) {
                var readers = ImageIO.getImageReaders(input);
                if (!readers.hasNext()) throw invalid();
                var reader = readers.next();
                BufferedImage source = null;
                try {
                    var format = reader.getFormatName();
                    if (!(png && format.equalsIgnoreCase("PNG") || jpg && format.equalsIgnoreCase("JPEG"))) throw invalid();
                    reader.setInput(input, true, true);
                    int width = reader.getWidth(0), height = reader.getHeight(0);
                    if (width <= 0 || height <= 0 || (long) width * height > 20_000_000L) throw invalid();
                    source = reader.read(0);
                    if (source == null) throw invalid();
                    return jpeg(source);
                } finally {
                    reader.dispose();
                    if (source != null) source.flush();
                }
            }
        } catch (IOException e) { throw invalid(); }
    }

    private byte[] jpeg(BufferedImage source) throws IOException {
        var image = new BufferedImage(EDGE, EDGE, BufferedImage.TYPE_INT_RGB);
        var graphics = image.createGraphics();
        try {
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, EDGE, EDGE);
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            int edge = Math.min(source.getWidth(), source.getHeight());
            int x = (source.getWidth() - edge) / 2, y = (source.getHeight() - edge) / 2;
            graphics.drawImage(source, 0, 0, EDGE, EDGE, x, y, x + edge, y + edge, null);
        } finally { graphics.dispose(); }
        var writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        try (var bytes = new ByteArrayOutputStream(); var output = new MemoryCacheImageOutputStream(bytes)) {
            writer.setOutput(output);
            var params = writer.getDefaultWriteParam();
            params.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            params.setCompressionQuality(.82f);
            writer.write(null, new IIOImage(image, null, null), params);
            output.flush();
            return bytes.toByteArray();
        } finally { writer.dispose(); image.flush(); }
    }

    private ResponseStatusException invalid() { return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY); }
}
