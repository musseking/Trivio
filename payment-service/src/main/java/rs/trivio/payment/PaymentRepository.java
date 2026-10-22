package rs.trivio.payment;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface PaymentRepository extends JpaRepository<PaymentAttempt,Long> {
    List<PaymentAttempt> findByOrderIdOrderByCreatedAtDesc(Long orderId);
}
