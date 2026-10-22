package rs.trivio.order;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/orders")
public class OrderController {
    private final OrderManager manager;
    private final TrivioAccess access;
    public OrderController(OrderManager manager, TrivioAccess access) {
        this.manager = manager;
        this.access = access;
    }

    @GetMapping
    public List<OrderResponse> all(@RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String bearer) {
        access.privileged(bearer);
        return manager.all();
    }

    @GetMapping("/mine")
    public List<OrderResponse> mine(@RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String bearer) {
        return manager.mine(access.user(bearer));
    }

    @GetMapping("/{id}")
    public OrderResponse get(@PathVariable Long id,
            @RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String bearer) {
        return manager.get(id, access.user(bearer));
    }

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse create(@Valid @RequestBody OrderRequest request,
            @RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String bearer) {
        return manager.create(request, access.user(bearer), bearer, access.keyForServiceCall());
    }

    @PostMapping("/{id}/confirm")
    public OrderResponse confirm(@PathVariable Long id,
            @RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String bearer,
            @RequestHeader(value="X-Trivio-Internal-Key",required=false) String internalKey) {
        TrivioAccess.User user = access.user(bearer);
        access.internal(internalKey);
        return manager.confirm(id, user, bearer, access.keyForServiceCall());
    }

    @PostMapping("/{id}/cancel")
    public OrderResponse cancel(@PathVariable Long id,
            @RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String bearer) {
        return manager.cancel(id, access.user(bearer), bearer, access.keyForServiceCall());
    }
}
