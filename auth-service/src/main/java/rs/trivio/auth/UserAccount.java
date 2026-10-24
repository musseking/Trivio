package rs.trivio.auth;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "users", uniqueConstraints = @UniqueConstraint(name = "uk_users_email", columnNames = "email"))
public class UserAccount {
    public enum Role { OWNER, ADMIN, CUSTOMER }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 80)
    private String firstName;
    @Column(nullable = false, length = 80)
    private String lastName;
    @Column(nullable = false, length = 254)
    private String email;
    @Column(nullable = false, length = 100)
    private String passwordHash;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Role role = Role.CUSTOMER;
    @Column(nullable = false)
    private boolean enabled = true;
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
    @Column(length = 36)
    private String profilePhotoVersion;

    protected UserAccount() {}
    public UserAccount(String firstName, String lastName, String email, String passwordHash) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.email = email;
        this.passwordHash = passwordHash;
    }
    @PrePersist public void prePersist() { if (createdAt == null) createdAt = Instant.now(); }
    public Long getId() { return id; }
    public String getFirstName() { return firstName; }
    public String getLastName() { return lastName; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public Role getRole() { return role; }
    public boolean isEnabled() { return enabled; }
    public Instant getCreatedAt() { return createdAt; }
    public String getProfilePhotoVersion() { return profilePhotoVersion; }
    public void setProfilePhotoVersion(String version) { this.profilePhotoVersion = version; }
    public void setRole(Role role) { this.role = role; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public void updateProfile(String firstName, String lastName, String email) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.email = email;
    }
}
