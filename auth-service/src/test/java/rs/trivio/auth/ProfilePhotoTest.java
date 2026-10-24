package rs.trivio.auth;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.*;
import java.util.Optional;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProfilePhotoTest {
    @Mock UserAccountRepository users;
    @Mock ProfilePhotoRepository photos;
    final ProfilePhotoCodec codec = new ProfilePhotoCodec();

    static Jwt jwt(long id) { return Jwt.withTokenValue("fixture").header("alg", "HS256").subject(Long.toString(id)).build(); }
    static UserAccount user(long id) {
        var user = new UserAccount("Test", "User", "test@example.invalid", "hash");
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }
    static byte[] image() throws IOException {
        var image = new BufferedImage(800, 600, BufferedImage.TYPE_INT_RGB);
        var graphics = image.createGraphics();
        graphics.setColor(Color.RED); graphics.fillRect(0, 0, 800, 600); graphics.dispose();
        try (var output = new ByteArrayOutputStream()) {
            ImageIO.write(image, "png", output);
            return output.toByteArray();
        } finally { image.flush(); }
    }

    @Test
    void reencodesToBoundedSquareJpegIgnoringFilenameAndClaimedMime() throws Exception {
        var bytes = codec.sanitize(new MockMultipartFile("file", "../../image.svg", "text/html", image()));
        assertEquals((byte) 0xff, bytes[0]);
        assertTrue(bytes.length < 1024 * 1024);
        var decoded = ImageIO.read(new ByteArrayInputStream(bytes));
        assertEquals(512, decoded.getWidth()); assertEquals(512, decoded.getHeight());
    }

    @Test
    void rejectsSvgCorruptAndOversizedUploads() {
        var svg = new MockMultipartFile("file", "image.png", "image/png", "<svg onload='alert(1)'/>".getBytes());
        assertEquals(HttpStatus.UNSUPPORTED_MEDIA_TYPE, assertThrows(ResponseStatusException.class, () -> codec.sanitize(svg)).getStatusCode());
        var corrupt = new MockMultipartFile("file", "bad.jpg", "image/jpeg", new byte[]{(byte)0xff, (byte)0xd8, (byte)0xff, 0});
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, assertThrows(ResponseStatusException.class, () -> codec.sanitize(corrupt)).getStatusCode());
        var huge = new MockMultipartFile("file", "large.png", "image/png", new byte[ProfilePhotoCodec.MAX_BYTES + 1]);
        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, assertThrows(ResponseStatusException.class, () -> codec.sanitize(huge)).getStatusCode());
    }

    @Test
    void uploadAndReplaceChangesVersionAndPersistsOnlySanitizedPhoto() throws Exception {
        var user = user(2L);
        when(users.findById(2L)).thenReturn(Optional.of(user));
        when(users.saveAndFlush(user)).thenReturn(user);
        var controller = new ProfilePhotoController(users, photos, codec);
        var file = new MockMultipartFile("file", "image.png", "image/png", image());
        String first = controller.upload(jwt(2L), file).profilePhotoVersion();
        assertNotNull(first);
        assertNotEquals(first, controller.upload(jwt(2L), file).profilePhotoVersion());
        verify(photos, times(2)).save(argThat(photo -> {
            try { return ImageIO.read(new ByteArrayInputStream(photo.getImage())).getWidth() == 512; }
            catch (IOException e) { return false; }
        }));
    }

    @Test
    void onlySelfOrDatabaseOwnerCanReadWithNoStoreResponse() {
        var owner = user(1L); owner.setRole(UserAccount.Role.OWNER);
        var target = user(2L); target.setProfilePhotoVersion("version");
        when(users.findById(1L)).thenReturn(Optional.of(owner));
        when(users.findById(2L)).thenReturn(Optional.of(target));
        when(photos.findById(2L)).thenReturn(Optional.of(new ProfilePhoto(2L, new byte[]{1, 2})));
        var controller = new ProfilePhotoController(users, photos, codec);
        assertEquals("private, no-store", controller.photo(jwt(1L), 2L).getHeaders().getCacheControl());
        assertArrayEquals(new byte[]{1, 2}, controller.photo(jwt(2L), 2L).getBody());
        var other = user(3L); other.setRole(UserAccount.Role.ADMIN);
        when(users.findById(3L)).thenReturn(Optional.of(other));
        assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class, () -> controller.photo(jwt(3L), 2L)).getStatusCode());
    }

    @Test
    void bannedAccountCannotReadOrWritePhotos() throws Exception {
        var target = user(2L); target.setEnabled(false);
        when(users.findById(2L)).thenReturn(Optional.of(target));
        var controller = new ProfilePhotoController(users, photos, codec);
        var file = new MockMultipartFile("file", "image.png", "image/png", image());
        assertEquals(HttpStatus.UNAUTHORIZED, assertThrows(ResponseStatusException.class, () -> controller.upload(jwt(2L), file)).getStatusCode());
        assertEquals(HttpStatus.UNAUTHORIZED, assertThrows(ResponseStatusException.class, () -> controller.photo(jwt(2L), 2L)).getStatusCode());
        verifyNoInteractions(photos);
    }

    @Test
    void removalClearsPhotoAndVersion() {
        var target = user(2L); target.setProfilePhotoVersion("old");
        when(users.findById(2L)).thenReturn(Optional.of(target));
        when(users.saveAndFlush(target)).thenReturn(target);
        var controller = new ProfilePhotoController(users, photos, codec);
        assertNull(controller.remove(jwt(2L)).profilePhotoVersion());
        verify(photos).deleteById(2L);
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ResponseStatusException.class, () -> controller.photo(jwt(2L), 2L)).getStatusCode());
    }
}
