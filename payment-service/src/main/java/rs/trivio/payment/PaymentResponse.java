package rs.trivio.payment;

import java.math.BigDecimal;
import java.time.Instant;
public record PaymentResponse(Long id,Long orderId,BigDecimal amount,PaymentStatus status,String message,Instant createdAt){
    public static PaymentResponse from(PaymentAttempt p){return new PaymentResponse(p.getId(),p.getOrderId(),p.getAmount(),p.getStatus(),p.getMessage(),p.getCreatedAt());}
}
