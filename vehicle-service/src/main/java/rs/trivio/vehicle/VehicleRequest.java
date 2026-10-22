package rs.trivio.vehicle;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
public record VehicleRequest(
    @NotBlank @Size(max = 120) String brand,
    @NotBlank @Size(max = 120) String model,
    @Min(1950) @Max(2100) int year,
    @NotNull @Positive @Digits(integer = 10, fraction = 2) BigDecimal price,
    @Min(0) @Max(10_000_000) int mileage,
    @NotBlank String fuelType,
    @Size(max = 40) String transmission,
    @Min(1) @Max(3000) Integer enginePowerHp,
    @Size(max = 80) String color,
    @Size(max = 6000) String description,
    @PositiveOrZero Long version
) {}
