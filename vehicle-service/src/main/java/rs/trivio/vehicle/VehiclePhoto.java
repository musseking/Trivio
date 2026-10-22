package rs.trivio.vehicle;

import jakarta.persistence.*;

/** Only generated, sanitized JPEG names are persisted; original uploads are never retained. */
@Entity
@Table(name = "vehicle_photos", uniqueConstraints = {
    @UniqueConstraint(name = "uk_vehicle_photos_filename", columnNames = "filename"),
    @UniqueConstraint(name = "uk_vehicle_photos_thumbnail", columnNames = "thumbnail_filename")
}, indexes = @Index(name = "idx_vehicle_photos_vehicle_position", columnList = "vehicle_id,position,id"))
public class VehiclePhoto {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "vehicle_id", nullable = false,
        foreignKey = @ForeignKey(name = "fk_vehicle_photos_vehicle"))
    private Vehicle vehicle;
    @Column(nullable = false, length = 64)
    private String filename;
    @Column(name = "thumbnail_filename", nullable = false, length = 64)
    private String thumbnailFilename;
    @Column(nullable = false)
    private int position;
    @Column(name = "is_cover", nullable = false)
    private boolean cover;

    protected VehiclePhoto() {}

    public VehiclePhoto(Vehicle vehicle, String filename, String thumbnailFilename, int position, boolean cover) {
        this.vehicle = vehicle;
        replaceFiles(filename, thumbnailFilename);
        this.position = position;
        this.cover = cover;
    }

    public Long getId() { return id; }
    public Vehicle getVehicle() { return vehicle; }
    public String getFilename() { return filename; }
    public String getThumbnailFilename() { return thumbnailFilename; }
    public int getPosition() { return position; }
    public boolean isCover() { return cover; }
    public void setPosition(int position) { this.position = position; }
    public void setCover(boolean cover) { this.cover = cover; }
    public void replaceFiles(String filename, String thumbnailFilename) {
        this.filename = filename;
        this.thumbnailFilename = thumbnailFilename;
    }
}
