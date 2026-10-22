package rs.trivio.vehicle;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "vehicles")
public class Vehicle {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Version private Long version;
    @Column(nullable = false) private String brand;
    @Column(nullable = false) private String model;
    @Column(name = "model_year", nullable = false) private int year;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal price;
    @Column(nullable = false) private int mileage;
    @Column(nullable = false) private String fuelType;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private VehicleStatus status = VehicleStatus.AVAILABLE;
    @Column(nullable = false) private boolean archived;
    @Column(length = 40) private String transmission;
    @Column(name = "engine_power_hp") private Integer enginePowerHp;
    @Column(length = 80) private String color;
    @Column(length = 6000) private String description;
    // Photos are removed only through the explicit photo API, never as a cascading side effect.
    @OneToMany(mappedBy = "vehicle")
    @OrderBy("position ASC, id ASC")
    private List<VehiclePhoto> photos = new ArrayList<>();

    protected Vehicle() {}
    public Vehicle(String brand, String model, int year, BigDecimal price, int mileage, String fuelType) {
        this.brand=brand; this.model=model; this.year=year; this.price=price;
        this.mileage=mileage; this.fuelType=fuelType;
    }
    public Long getId() { return id; }
    public Long getVersion() { return version; }
    public String getBrand() { return brand; }
    public String getModel() { return model; }
    public int getYear() { return year; }
    public BigDecimal getPrice() { return price; }
    public int getMileage() { return mileage; }
    public String getFuelType() { return fuelType; }
    public VehicleStatus getStatus() { return status; }
    public void setStatus(VehicleStatus status) { this.status = status; }
    public boolean isArchived() { return archived; }
    public void setArchived(boolean archived) { this.archived = archived; }
    public String getTransmission() { return transmission; }
    public Integer getEnginePowerHp() { return enginePowerHp; }
    public String getColor() { return color; }
    public String getDescription() { return description; }
    public List<VehiclePhoto> getPhotos() { return photos; }
    public void update(VehicleRequest r) {
        brand=r.brand(); model=r.model(); year=r.year(); price=r.price(); mileage=r.mileage(); fuelType=r.fuelType();
        transmission=r.transmission(); enginePowerHp=r.enginePowerHp(); color=r.color(); description=r.description();
    }
}
