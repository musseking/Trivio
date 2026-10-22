package rs.trivio.order;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name="purchase_orders")
public class PurchaseOrder {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Version private Long version;
    // Nullable solely to preserve existing legacy rows; new orders always have an account id.
    @Column(name="user_id") private Long userId;
    @Column(nullable=false) private String customerName;
    @Column(nullable=false) private String customerEmail;
    @Column(nullable=false) private Long vehicleId;
    @Column(nullable=false,precision=12,scale=2) private BigDecimal price;
    @Enumerated(EnumType.STRING) @Column(nullable=false) private OrderStatus status=OrderStatus.PENDING;
    @Column(nullable=false) private Instant createdAt=Instant.now();
    protected PurchaseOrder() {}
    public PurchaseOrder(Long userId,String name,String email,Long vehicleId,BigDecimal price) {
        this.userId=userId;this.customerName=name;this.customerEmail=email;this.vehicleId=vehicleId;this.price=price;
    }
    public Long getId(){return id;}
    public Long getUserId(){return userId;}
    public String getCustomerName(){return customerName;}
    public String getCustomerEmail(){return customerEmail;}
    public Long getVehicleId(){return vehicleId;}
    public BigDecimal getPrice(){return price;}
    public OrderStatus getStatus(){return status;}
    public void setStatus(OrderStatus v){status=v;}
    public Instant getCreatedAt(){return createdAt;}
}
