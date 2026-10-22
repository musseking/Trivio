
package rs.trivio.auth;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface OwnerBootstrapRepository
        extends JpaRepository<OwnerBootstrap, Byte> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        SELECT b
        FROM OwnerBootstrap b
        WHERE b.id = :id
        """)
    Optional<OwnerBootstrap> lockById(@Param("id") byte id);
}
