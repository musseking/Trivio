package rs.trivio.vehicle;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/vehicles")
public class VehicleController {
    private final VehicleManager manager;
    private final TrivioAccess access;
    public VehicleController(VehicleManager manager,TrivioAccess access){this.manager=manager;this.access=access;}
    // Public catalogue: no JWT required.
    @GetMapping public List<VehicleResponse> all(){return manager.all();}
    @GetMapping("/{id}") public VehicleResponse get(@PathVariable Long id){return manager.get(id);}

    @GetMapping("/manage")
    public List<VehicleResponse> manage(@RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String bearer){
        access.owner(bearer);
        return manager.manageAll();
    }

    @PostMapping("/{id}/archive")
    public VehicleResponse archive(@PathVariable Long id,
            @RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String bearer){
        access.owner(bearer);
        return manager.archive(id);
    }

    @PostMapping("/{id}/restore")
    public VehicleResponse restore(@PathVariable Long id,
            @RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String bearer){
        access.owner(bearer);
        return manager.restore(id);
    }

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public VehicleResponse create(@Valid @RequestBody VehicleRequest r,
            @RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String bearer){
        access.privileged(bearer);
        return manager.create(r);
    }
    @PutMapping("/{id}") public VehicleResponse update(@PathVariable Long id,
            @Valid @RequestBody VehicleRequest r,
            @RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String bearer){
        access.privileged(bearer);
        return manager.update(id,r);
    }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id,
            @RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String bearer){
        access.privileged(bearer);
        // Preserve existing references and photo metadata; withdrawal is a soft archive.
        manager.delete(id);
    }

    // State transitions are exclusively part of the order/payment orchestration.
    @PostMapping("/{id}/reserve") public VehicleResponse reserve(@PathVariable Long id,
            @RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String bearer,
            @RequestHeader(value="X-Trivio-Internal-Key",required=false) String key){
        access.user(bearer);access.internal(key);return manager.reserve(id);
    }
    @PostMapping("/{id}/release") public VehicleResponse release(@PathVariable Long id,
            @RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String bearer,
            @RequestHeader(value="X-Trivio-Internal-Key",required=false) String key){
        access.user(bearer);access.internal(key);return manager.release(id);
    }
    @PostMapping("/{id}/sell") public VehicleResponse sell(@PathVariable Long id,
            @RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String bearer,
            @RequestHeader(value="X-Trivio-Internal-Key",required=false) String key){
        access.user(bearer);access.internal(key);return manager.sell(id);
    }
}
