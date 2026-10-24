package rs.trivio.auth;

import jakarta.persistence.*;

@Entity
@Table(name = "user_profile_photos")
public class ProfilePhoto {
    @Id
    private Long userId;
    @Lob
    @Column(nullable = false, columnDefinition = "MEDIUMBLOB")
    private byte[] image;

    protected ProfilePhoto() {}
    public ProfilePhoto(Long userId, byte[] image) { this.userId = userId; this.image = image; }
    public byte[] getImage() { return image; }
}
