
package rs.trivio.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Entity
@Table(name = "owner_bootstrap")
public class OwnerBootstrap {

    @Id
    private Byte id;

    @Column(nullable = false)
    private boolean completed;

    @Column(name = "owner_user_id")
    private Long ownerUserId;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    protected OwnerBootstrap() {
    }

    public boolean isCompleted() {
        return completed;
    }

    public Long getOwnerUserId() {
        return ownerUserId;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }

    public void complete(Long userId) {
        if (completed) {
            throw new IllegalStateException(
                "Owner setup has already been completed"
            );
        }

        if (userId == null) {
            throw new IllegalArgumentException(
                "Owner user ID is required"
            );
        }

        this.completed = true;
        this.ownerUserId = userId;
        this.completedAt = LocalDateTime.now(ZoneOffset.UTC);
    }
}
