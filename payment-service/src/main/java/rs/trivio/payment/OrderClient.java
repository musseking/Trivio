package rs.trivio.payment;

import java.math.BigDecimal;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;
@FeignClient(name="order-service",path="/orders")
public interface OrderClient {
    @GetMapping("/{id}") OrderSnapshot get(@PathVariable("id") Long id,
        @RequestHeader("Authorization") String bearer);
    @PostMapping("/{id}/confirm") OrderSnapshot confirm(@PathVariable("id") Long id,
        @RequestHeader("Authorization") String bearer, @RequestHeader("X-Trivio-Internal-Key") String key);
    record OrderSnapshot(Long id,Long userId,Long vehicleId,BigDecimal price,String status) {}
}
