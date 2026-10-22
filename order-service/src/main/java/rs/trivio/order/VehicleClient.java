package rs.trivio.order;

import java.math.BigDecimal;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
@FeignClient(name="vehicle-service",path="/vehicles")
public interface VehicleClient {
    @PostMapping("/{id}/reserve") VehicleSnapshot reserve(@PathVariable("id") Long id,
        @RequestHeader("Authorization") String bearer, @RequestHeader("X-Trivio-Internal-Key") String key);
    @PostMapping("/{id}/release") VehicleSnapshot release(@PathVariable("id") Long id,
        @RequestHeader("Authorization") String bearer, @RequestHeader("X-Trivio-Internal-Key") String key);
    @PostMapping("/{id}/sell") VehicleSnapshot sell(@PathVariable("id") Long id,
        @RequestHeader("Authorization") String bearer, @RequestHeader("X-Trivio-Internal-Key") String key);
    record VehicleSnapshot(Long id,BigDecimal price,String status) {}
}
