package rs.trivio.vehicle;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@Service
public class VehicleManager {
    private final VehicleRepository repo;
    public VehicleManager(VehicleRepository repo) { this.repo=repo; }

    @Transactional(readOnly = true)
    public List<VehicleResponse> all() { return repo.findByArchivedFalseOrderByIdDesc().stream().map(VehicleResponse::from).toList(); }
    @Transactional(readOnly = true)
    public List<VehicleResponse> manageAll() { return repo.findAllByOrderByIdDesc().stream().map(VehicleResponse::from).toList(); }
    @Transactional(readOnly = true)
    public VehicleResponse get(Long id) { return VehicleResponse.from(find(id)); }
    @Transactional
    public VehicleResponse create(VehicleRequest r) {
        Vehicle v=new Vehicle(r.brand(),r.model(),r.year(),r.price(),r.mileage(),r.fuelType());
        v.update(r);
        return VehicleResponse.from(repo.saveAndFlush(v));
    }
    @Transactional
    public VehicleResponse update(Long id, VehicleRequest r) {
        Vehicle v=locked(id); requireAvailable(v);
        if(r.version()!=null && !r.version().equals(v.getVersion()))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Vehicle was changed; reload it before saving");
        v.update(r); repo.flush(); return VehicleResponse.from(v);
    }
    @Transactional
    public void delete(Long id) { Vehicle v=locked(id); requireAvailable(v); v.setArchived(true); }
    @Transactional
    public VehicleResponse archive(Long id) {
        Vehicle v=locked(id); requireNotReserved(v); v.setArchived(true); repo.flush(); return VehicleResponse.from(v);
    }
    @Transactional
    public VehicleResponse restore(Long id) {
        Vehicle v=locked(id); requireNotReserved(v); v.setArchived(false); repo.flush(); return VehicleResponse.from(v);
    }
    @Transactional
    public VehicleResponse reserve(Long id) {
        Vehicle v=locked(id); requireAvailable(v);
        if(v.isArchived()) throw new ResponseStatusException(HttpStatus.CONFLICT,"Vehicle is archived");
        v.setStatus(VehicleStatus.RESERVED); return VehicleResponse.from(v);
    }
    @Transactional
    public VehicleResponse release(Long id) {
        Vehicle v=locked(id);
        if(v.getStatus()!=VehicleStatus.RESERVED) throw new ResponseStatusException(HttpStatus.CONFLICT,"Vehicle is not reserved");
        v.setStatus(VehicleStatus.AVAILABLE); return VehicleResponse.from(v);
    }
    @Transactional
    public VehicleResponse sell(Long id) {
        Vehicle v=locked(id);
        if(v.getStatus()!=VehicleStatus.RESERVED) throw new ResponseStatusException(HttpStatus.CONFLICT,"Vehicle must be reserved before sale");
        v.setStatus(VehicleStatus.SOLD); return VehicleResponse.from(v);
    }
    private Vehicle find(Long id) { return repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"Vehicle not found")); }
    private Vehicle locked(Long id) { return repo.findForUpdate(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"Vehicle not found")); }
    private void requireAvailable(Vehicle v) {
        if(v.getStatus()!=VehicleStatus.AVAILABLE) throw new ResponseStatusException(HttpStatus.CONFLICT,"Vehicle is not available");
    }
    private void requireNotReserved(Vehicle v) {
        if(v.getStatus()==VehicleStatus.RESERVED) throw new ResponseStatusException(HttpStatus.CONFLICT,"Reserved vehicles cannot be archived or restored");
    }
}
