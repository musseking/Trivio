package rs.trivio.payment;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/payments")
public class PaymentController {
    private final PaymentManager manager;
    private final TrivioAccess access;
    public PaymentController(PaymentManager manager,TrivioAccess access) {
        this.manager=manager;this.access=access;
    }

    @GetMapping
    public List<PaymentResponse> all(@RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String bearer) {
        access.privileged(bearer);
        return manager.all();
    }
    @GetMapping("/{id}")
    public PaymentResponse get(@PathVariable Long id,
            @RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String bearer) {
        access.user(bearer);
        return manager.get(id,bearer);
    }
    @GetMapping("/order/{id}")
    public List<PaymentResponse> byOrder(@PathVariable Long id,
            @RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String bearer) {
        access.user(bearer);
        return manager.byOrder(id,bearer);
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public PaymentResponse pay(@Valid @RequestBody PaymentRequest req,
            @RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String bearer) {
        access.user(bearer);
        return manager.pay(req,bearer,access.keyForServiceCall());
    }
}
