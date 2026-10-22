package rs.trivio.payment;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
@Entity
@Table(name="payment_attempts")
public class PaymentAttempt {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(nullable=false) private Long orderId;
    @Column(nullable=false,precision=12,scale=2) private BigDecimal amount;
    @Enumerated(EnumType.STRING) @Column(nullable=false) private PaymentStatus status;
    @Column(nullable=false) private String message;
    @Column(nullable=false) private Instant createdAt=Instant.now();
    protected PaymentAttempt(){}
    public PaymentAttempt(Long orderId, BigDecimal amount, PaymentStatus status, String message){
        this.orderId=orderId;this.amount=amount;this.status=status;this.message=message;
    }
    public Long getId(){return id;}
    public Long getOrderId(){return orderId;}
    public BigDecimal getAmount(){return amount;}
    public PaymentStatus getStatus(){return status;}
    public String getMessage(){return message;}
    public Instant getCreatedAt(){return createdAt;}
}
