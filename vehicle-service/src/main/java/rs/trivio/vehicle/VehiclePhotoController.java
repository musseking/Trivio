package rs.trivio.vehicle;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/vehicles")
public class VehiclePhotoController {
    private final VehiclePhotoManager manager;
    private final TrivioAccess access;

    public VehiclePhotoController(VehiclePhotoManager manager, TrivioAccess access) {
        this.manager = manager;
        this.access = access;
    }

    @GetMapping("/{vehicleId}/photos")
    public List<VehiclePhotoResponse> list(@PathVariable Long vehicleId) { return manager.list(vehicleId); }

    @GetMapping(value = "/media/{filename}", produces = MediaType.IMAGE_JPEG_VALUE)
    public ResponseEntity<byte[]> media(@PathVariable String filename) {
        byte[] bytes = manager.media(filename);
        return ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG).contentLength(bytes.length)
            .header(HttpHeaders.CACHE_CONTROL, "public, max-age=31536000, immutable")
            .header("X-Content-Type-Options", "nosniff").body(bytes);
    }

    @PostMapping(value = "/{vehicleId}/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public List<VehiclePhotoResponse> upload(@PathVariable Long vehicleId,
            @RequestParam("files") List<MultipartFile> files,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String bearer) {
        access.owner(bearer);
        return manager.upload(vehicleId, files);
    }

    @PutMapping("/{vehicleId}/photos/order")
    public List<VehiclePhotoResponse> reorder(@PathVariable Long vehicleId, @Valid @RequestBody VehiclePhotoOrderRequest request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String bearer) {
        access.owner(bearer);
        return manager.reorder(vehicleId, request);
    }

    @DeleteMapping("/{vehicleId}/photos/{photoId}")
    public List<VehiclePhotoResponse> delete(@PathVariable Long vehicleId, @PathVariable Long photoId,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String bearer) {
        access.owner(bearer);
        return manager.delete(vehicleId, photoId);
    }

    @PutMapping(value = "/{vehicleId}/photos/{photoId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public List<VehiclePhotoResponse> replace(@PathVariable Long vehicleId, @PathVariable Long photoId,
            @RequestParam("file") MultipartFile file,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String bearer) {
        access.owner(bearer);
        return manager.replace(vehicleId, photoId, file);
    }
}
