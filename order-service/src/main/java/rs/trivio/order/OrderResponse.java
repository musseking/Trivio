package rs.trivio.order;

import java.math.BigDecimal;
import java.time.Instant;
public record OrderResponse(Long id,Long userId,String customerName,String customerEmail,
    Long vehicleId,BigDecimal price,OrderStatus status,Instant createdAt) {
    public static OrderResponse from(PurchaseOrder o){
        return new OrderResponse(o.getId(),o.getUserId(),o.getCustomerName(),o.getCustomerEmail(),
                o.getVehicleId(),o.getPrice(),o.getStatus(),o.getCreatedAt());
    }
}
