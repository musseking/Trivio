package rs.trivio.order;

import feign.FeignException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OrderManager {
    private final OrderRepository repo;
    private final VehicleClient vehicle;
    public OrderManager(OrderRepository repo,VehicleClient vehicle){this.repo=repo;this.vehicle=vehicle;}

    @Transactional(readOnly=true)
    public List<OrderResponse> all(){return repo.findAll().stream().map(OrderResponse::from).toList();}

    @Transactional(readOnly=true)
    public List<OrderResponse> mine(TrivioAccess.User user){
        return repo.findByUserIdOrderByCreatedAtDesc(user.id()).stream().map(OrderResponse::from).toList();
    }

    @Transactional(readOnly=true)
    public OrderResponse get(Long id,TrivioAccess.User user){
        PurchaseOrder order=find(id);
        requireOwnerOrPrivileged(order,user);
        return OrderResponse.from(order);
    }

    @Transactional
    public OrderResponse create(OrderRequest req,TrivioAccess.User user,String bearer,String internalKey){
        VehicleClient.VehicleSnapshot reserved;
        try { reserved=vehicle.reserve(req.vehicleId(), bearer, internalKey); }
        catch(FeignException e){throw convert(e,"Vehicle reservation failed");}
        try {
            return OrderResponse.from(repo.save(new PurchaseOrder(user.id(),user.fullName(),user.email(),
                    req.vehicleId(),reserved.price())));
        } catch(RuntimeException e){
            // Compensating action is best effort, not a distributed ACID transaction.
            try { vehicle.release(req.vehicleId(), bearer, internalKey); } catch(RuntimeException ignored) {}
            throw e;
        }
    }

    @Transactional
    public OrderResponse confirm(Long id,TrivioAccess.User user,String bearer,String internalKey){
        PurchaseOrder order=locked(id);
        requireOwnerOrPrivileged(order,user);
        if(order.getStatus()!=OrderStatus.PENDING)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Order is not pending");
        try {vehicle.sell(order.getVehicleId(), bearer, internalKey);}
        catch(FeignException e){throw convert(e,"Vehicle sale failed");}
        order.setStatus(OrderStatus.CONFIRMED);
        return OrderResponse.from(order);
    }

    @Transactional
    public OrderResponse cancel(Long id,TrivioAccess.User user,String bearer,String internalKey){
        PurchaseOrder order=locked(id);
        requireOwnerOrPrivileged(order,user);
        if(order.getStatus()!=OrderStatus.PENDING)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Only pending orders can be cancelled");
        try {vehicle.release(order.getVehicleId(), bearer, internalKey);}
        catch(FeignException e){throw convert(e,"Vehicle release failed");}
        order.setStatus(OrderStatus.CANCELLED);
        return OrderResponse.from(order);
    }

    private void requireOwnerOrPrivileged(PurchaseOrder order,TrivioAccess.User user){
        // Legacy orders with null userId are admin-only; do not trust customerEmail for authorization.
        if(!user.privileged() && (order.getUserId()==null || !order.getUserId().equals(user.id())))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"This order belongs to another account");
    }
    private PurchaseOrder find(Long id){return repo.findById(id).orElseThrow(
        ()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Order not found"));}
    private PurchaseOrder locked(Long id){return repo.findForUpdate(id).orElseThrow(
        ()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Order not found"));}
    private ResponseStatusException convert(FeignException e,String message){
        HttpStatus code=e.status()==404?HttpStatus.NOT_FOUND:e.status()==409?HttpStatus.CONFLICT:
            e.status()==401?HttpStatus.UNAUTHORIZED:e.status()==403?HttpStatus.FORBIDDEN:HttpStatus.SERVICE_UNAVAILABLE;
        return new ResponseStatusException(code,message,e);
    }
}
