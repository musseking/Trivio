package rs.trivio.vehicle;

import java.math.BigDecimal;
import java.util.List;
public record VehicleResponse(Long id, String brand, String model, int year,
    BigDecimal price, int mileage, String fuelType, VehicleStatus status,
    Long version, boolean archived, String transmission, Integer enginePowerHp,
    String color, String description, List<VehiclePhotoResponse> photos) {
    public static VehicleResponse from(Vehicle v) {
        return new VehicleResponse(v.getId(), v.getBrand(), v.getModel(), v.getYear(),
            v.getPrice(), v.getMileage(), v.getFuelType(), v.getStatus(), v.getVersion(),
            v.isArchived(), v.getTransmission(), v.getEnginePowerHp(), v.getColor(),
            v.getDescription(), v.getPhotos().stream().map(VehiclePhotoResponse::from).toList());
    }
}
