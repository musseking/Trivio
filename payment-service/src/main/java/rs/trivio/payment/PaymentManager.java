package rs.trivio.payment;

import feign.FeignException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PaymentManager {
    private final PaymentRepository repo;
    private final OrderClient orders;
    public PaymentManager(PaymentRepository repo,OrderClient orders){this.repo=repo;this.orders=orders;}

    public List<PaymentResponse> all(){return repo.findAll().stream().map(PaymentResponse::from).toList();}

    public PaymentResponse get(Long id,String bearer){
        PaymentAttempt payment=repo.findById(id).orElseThrow(
            ()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Payment not found"));
        checkedOrder(payment.getOrderId(),bearer);
        return PaymentResponse.from(payment);
    }

    public List<PaymentResponse> byOrder(Long orderId,String bearer){
        checkedOrder(orderId,bearer);
        return repo.findByOrderIdOrderByCreatedAtDesc(orderId).stream().map(PaymentResponse::from).toList();
    }

    public PaymentResponse pay(PaymentRequest req,String bearer,String internalKey){
        OrderClient.OrderSnapshot order=checkedOrder(req.orderId(),bearer);
        if(!"PENDING".equals(order.status()))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Order is not pending");
        // EDUCATIONAL SIMULATOR: approved comes from the user, not a payment processor!
        if(!req.approved())
            return PaymentResponse.from(repo.save(new PaymentAttempt(order.id(),order.price(),
                PaymentStatus.FAILED,"Simulated payment declined")));
        try {orders.confirm(order.id(),bearer,internalKey);}
        catch(FeignException e){throw convert(e,"Could not confirm order");}
        return PaymentResponse.from(repo.save(new PaymentAttempt(order.id(),order.price(),
                PaymentStatus.SUCCESS,"Simulated payment accepted")));
    }

    private OrderClient.OrderSnapshot checkedOrder(Long id,String bearer){
        try {return orders.get(id,bearer);}
        catch(FeignException e){throw convert(e,"Could not load order");}
    }
    private ResponseStatusException convert(FeignException e,String message){
        HttpStatus code=e.status()==404?HttpStatus.NOT_FOUND:e.status()==409?HttpStatus.CONFLICT:
            e.status()==401?HttpStatus.UNAUTHORIZED:e.status()==403?HttpStatus.FORBIDDEN:HttpStatus.SERVICE_UNAVAILABLE;
        return new ResponseStatusException(code,message,e);
    }
}
