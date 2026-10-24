package rs.trivio.auth;

import java.util.UUID;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/auth")
public class ProfilePhotoController {
    private final UserAccountRepository users;
    private final ProfilePhotoRepository photos;
    private final ProfilePhotoCodec codec;

    public ProfilePhotoController(UserAccountRepository users, ProfilePhotoRepository photos, ProfilePhotoCodec codec) {
        this.users = users; this.photos = photos; this.codec = codec;
    }

    @PutMapping(value = "/me/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public AuthController.UserView upload(@AuthenticationPrincipal Jwt jwt, @RequestParam("file") MultipartFile file) {
        UserAccount user = current(jwt);
        byte[] image = codec.sanitize(file);
        photos.save(new ProfilePhoto(user.getId(), image));
        user.setProfilePhotoVersion(UUID.randomUUID().toString());
        return AuthController.UserView.from(users.saveAndFlush(user));
    }

    @DeleteMapping("/me/photo")
    @Transactional
    public AuthController.UserView remove(@AuthenticationPrincipal Jwt jwt) {
        UserAccount user = current(jwt);
        photos.deleteById(user.getId());
        user.setProfilePhotoVersion(null);
        return AuthController.UserView.from(users.saveAndFlush(user));
    }

    @GetMapping("/users/{id}/photo")
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> photo(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        UserAccount viewer = current(jwt);
        if (!viewer.getId().equals(id) && viewer.getRole() != UserAccount.Role.OWNER)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        var target = users.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (target.getProfilePhotoVersion() == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        byte[] image = photos.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND)).getImage();
        return ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG).contentLength(image.length)
            .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
            .header("X-Content-Type-Options", "nosniff").body(image);
    }

    private UserAccount current(Jwt jwt) {
        Long id;
        try { id = Long.valueOf(jwt.getSubject()); }
        catch (NumberFormatException e) { throw new ResponseStatusException(HttpStatus.UNAUTHORIZED); }
        UserAccount user = users.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (!user.isEnabled()) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return user;
    }
}
