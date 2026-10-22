package rs.trivio.vehicle;

public record VehiclePhotoResponse(Long id, String url, String thumbnailUrl, int position, boolean cover) {
    public static VehiclePhotoResponse from(VehiclePhoto photo) {
        return new VehiclePhotoResponse(photo.getId(), "/api/vehicles/media/" + photo.getFilename(),
            "/api/vehicles/media/" + photo.getThumbnailFilename(), photo.getPosition(), photo.isCover());
    }
}
