package rs.trivio.vehicle;

import static org.junit.jupiter.api.Assertions.*;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.math.BigDecimal;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class VehicleRequestValidationTest {
    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll static void tearDown() { factory.close(); }

    @Test void legacyPayloadWithNoOptionalDetailsIsValid() {
        VehicleRequest request = new VehicleRequest("Brand", "Model", 2020, new BigDecimal("10000.00"),
            50000, "Petrol", null, null, null, null, null);

        assertTrue(validator.validate(request).isEmpty());
    }

    @Test void rejectsValuesOutsideDatabaseAndBusinessLimits() {
        VehicleRequest request = new VehicleRequest("b".repeat(121), " ", 2101,
            new BigDecimal("10000000000.001"), 10_000_001, " ", "t".repeat(41),
            3001, "c".repeat(81), "d".repeat(6001), -1L);
        Set<String> fields = validator.validate(request).stream()
            .map(violation -> violation.getPropertyPath().toString()).collect(Collectors.toSet());

        assertEquals(Set.of("brand", "model", "year", "price", "mileage", "fuelType", "transmission",
            "enginePowerHp", "color", "description", "version"), fields);
    }

    @Test void exactUpperBoundsRemainValid() {
        VehicleRequest request = new VehicleRequest("b".repeat(120), "m".repeat(120), 2100,
            new BigDecimal("9999999999.99"), 10_000_000, "Petrol", "t".repeat(40),
            3000, "c".repeat(80), "d".repeat(6000), 0L);

        assertTrue(validator.validate(request).isEmpty());
    }
}
