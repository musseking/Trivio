package rs.trivio.vehicle;

import java.math.BigDecimal;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
@Configuration
public class SeedData {
    @Bean ApplicationRunner vehicleSeed(VehicleRepository repo) {
        return args -> {
            if(repo.count()!=0) return;
            repo.save(new Vehicle("BMW", "320d", 2021, new BigDecimal("25000.00"), 68000, "DIESEL"));
            repo.save(new Vehicle("Audi", "A4", 2020, new BigDecimal("21800.00"), 91000, "DIESEL"));
            repo.save(new Vehicle("Toyota", "Corolla", 2023, new BigDecimal("22900.00"), 22000, "HYBRID"));
        };
    }
}
