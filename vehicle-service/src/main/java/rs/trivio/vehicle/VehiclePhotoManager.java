package rs.trivio.vehicle;

import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class VehiclePhotoManager {
    private static final int MAX_PHOTOS = 10;
    private final VehicleRepository vehicles;
    private final VehiclePhotoRepository photos;
    private final VehiclePhotoStorage storage;

    public VehiclePhotoManager(VehicleRepository vehicles, VehiclePhotoRepository photos, VehiclePhotoStorage storage) {
        this.vehicles = vehicles;
        this.photos = photos;
        this.storage = storage;
    }

    @Transactional(readOnly = true)
    public List<VehiclePhotoResponse> list(Long vehicleId) {
        vehicles.findById(vehicleId).orElseThrow(VehiclePhotoManager::vehicleMissing);
        return responses(ordered(vehicleId));
    }

    @Transactional(readOnly = true)
    public byte[] media(String filename) {
        if (!VehiclePhotoStorage.isGeneratedFilename(filename)
            || !photos.existsByFilenameOrThumbnailFilename(filename, filename))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Fotografija nije pronađena.");
        return storage.read(filename);
    }

    @Transactional
    public List<VehiclePhotoResponse> upload(Long vehicleId, List<MultipartFile> files) {
        Vehicle vehicle = locked(vehicleId);
        List<VehiclePhoto> existing = ordered(vehicleId);
        if (files == null || files.isEmpty()) throw invalid("Dodajte bar jednu fotografiju.");
        if (files.size() > MAX_PHOTOS - existing.size())
            throw invalid("Automobil može imati najviše 10 fotografija.");
        FileChanges changes = changes();
        for (MultipartFile file : files) {
            VehiclePhotoStorage.StoredPhoto stored = storage.store(file);
            changes.created.add(stored);
            VehiclePhoto photo = new VehiclePhoto(vehicle, stored.filename(), stored.thumbnailFilename(), existing.size(), existing.isEmpty());
            existing.add(photos.save(photo));
        }
        normalize(existing);
        photos.flush();
        return responses(existing);
    }

    @Transactional
    public List<VehiclePhotoResponse> reorder(Long vehicleId, VehiclePhotoOrderRequest request) {
        locked(vehicleId);
        List<VehiclePhoto> existing = ordered(vehicleId);
        if (request == null || request.photoIds() == null || request.coverPhotoId() == null
            || request.photoIds().isEmpty() || request.photoIds().size() != existing.size()
            || request.photoIds().size() > MAX_PHOTOS || request.photoIds().stream().anyMatch(Objects::isNull))
            throw invalid("Pošaljite sve fotografije vozila i izaberite naslovnu fotografiju.");
        Map<Long, VehiclePhoto> byId = new HashMap<>();
        for (VehiclePhoto photo : existing) byId.put(photo.getId(), photo);
        Set<Long> requestedIds = new HashSet<>(request.photoIds());
        if (requestedIds.size() != existing.size() || !requestedIds.equals(byId.keySet())
            || !requestedIds.contains(request.coverPhotoId()))
            throw invalid("Redosled mora sadržati tačno sve fotografije ovog vozila.");
        List<VehiclePhoto> reordered = new ArrayList<>();
        for (int index = 0; index < request.photoIds().size(); index++) {
            VehiclePhoto photo = byId.get(request.photoIds().get(index));
            photo.setPosition(index);
            photo.setCover(Objects.equals(photo.getId(), request.coverPhotoId()));
            reordered.add(photo);
        }
        photos.flush();
        return responses(reordered);
    }

    @Transactional
    public List<VehiclePhotoResponse> delete(Long vehicleId, Long photoId) {
        locked(vehicleId);
        List<VehiclePhoto> existing = ordered(vehicleId);
        VehiclePhoto photo = photo(existing, photoId);
        FileChanges changes = changes();
        changes.removed.add(files(photo));
        photos.delete(photo);
        existing.remove(photo);
        normalize(existing);
        photos.flush();
        return responses(existing);
    }

    @Transactional
    public List<VehiclePhotoResponse> replace(Long vehicleId, Long photoId, MultipartFile file) {
        locked(vehicleId);
        List<VehiclePhoto> existing = ordered(vehicleId);
        VehiclePhoto photo = photo(existing, photoId);
        FileChanges changes = changes();
        VehiclePhotoStorage.StoredPhoto stored = storage.store(file);
        changes.created.add(stored);
        changes.removed.add(files(photo));
        photo.replaceFiles(stored.filename(), stored.thumbnailFilename());
        photos.flush();
        return responses(existing);
    }

    private Vehicle locked(Long id) { return vehicles.findForUpdate(id).orElseThrow(VehiclePhotoManager::vehicleMissing); }
    private List<VehiclePhoto> ordered(Long id) { return new ArrayList<>(photos.findByVehicleIdOrderByPositionAscIdAsc(id)); }
    private static VehiclePhoto photo(List<VehiclePhoto> existing, Long id) {
        return existing.stream().filter(photo -> Objects.equals(photo.getId(), id)).findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Fotografija nije pronađena za ovaj automobil."));
    }
    private static void normalize(List<VehiclePhoto> existing) {
        VehiclePhoto cover = existing.stream().filter(VehiclePhoto::isCover).findFirst().orElse(existing.isEmpty() ? null : existing.getFirst());
        for (int index = 0; index < existing.size(); index++) {
            existing.get(index).setPosition(index);
            existing.get(index).setCover(existing.get(index) == cover);
        }
    }
    private static List<VehiclePhotoResponse> responses(List<VehiclePhoto> photos) {
        return photos.stream().map(VehiclePhotoResponse::from).toList();
    }
    private static VehiclePhotoStorage.StoredPhoto files(VehiclePhoto photo) {
        return new VehiclePhotoStorage.StoredPhoto(photo.getFilename(), photo.getThumbnailFilename());
    }

    /** Register before the first file is written so all earlier successful files survive only a committed transaction. */
    private FileChanges changes() {
        if (!TransactionSynchronizationManager.isSynchronizationActive()
            || !TransactionSynchronizationManager.isActualTransactionActive())
            throw new IllegalStateException("Photo writes require a transaction");
        FileChanges changes = new FileChanges();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { changes.removed.forEach(storage::deleteQuietly); }
            @Override public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) changes.created.forEach(storage::deleteQuietly);
            }
        });
        return changes;
    }
    private static final class FileChanges {
        final List<VehiclePhotoStorage.StoredPhoto> created = new ArrayList<>();
        final List<VehiclePhotoStorage.StoredPhoto> removed = new ArrayList<>();
    }
    private static ResponseStatusException vehicleMissing() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Automobil nije pronađen.");
    }
    private static ResponseStatusException invalid(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
