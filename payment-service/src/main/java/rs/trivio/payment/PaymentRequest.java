package rs.trivio.payment;

import jakarta.validation.constraints.*;
public record PaymentRequest(@NotNull @Positive Long orderId, @NotNull Boolean approved) {}
