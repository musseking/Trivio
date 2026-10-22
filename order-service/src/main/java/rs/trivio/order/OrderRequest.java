package rs.trivio.order;

import jakarta.validation.constraints.*;
/** Buyer identity comes exclusively from the authenticated account, never the JSON body. */
public record OrderRequest(@NotNull @Positive Long vehicleId) {}
