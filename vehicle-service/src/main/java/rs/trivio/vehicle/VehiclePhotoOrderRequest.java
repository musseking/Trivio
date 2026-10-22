package rs.trivio.vehicle;

import jakarta.validation.constraints.*;
import java.util.List;

public record VehiclePhotoOrderRequest(
    @NotEmpty @Size(max = 10) List<@NotNull @Positive Long> photoIds,
    @NotNull @Positive Long coverPhotoId
) {}
