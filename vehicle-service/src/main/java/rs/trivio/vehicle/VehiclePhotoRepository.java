package rs.trivio.vehicle;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VehiclePhotoRepository extends JpaRepository<VehiclePhoto, Long> {
    List<VehiclePhoto> findByVehicleIdOrderByPositionAscIdAsc(Long vehicleId);
    boolean existsByFilenameOrThumbnailFilename(String filename, String thumbnailFilename);
}
