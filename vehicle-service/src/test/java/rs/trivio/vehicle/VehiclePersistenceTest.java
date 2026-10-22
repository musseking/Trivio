package rs.trivio.vehicle;

import static org.junit.jupiter.api.Assertions.*;

import jakarta.persistence.OptimisticLockException;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;
import org.hibernate.Session;
import org.hibernate.SessionFactory;
import org.hibernate.StaleStateException;
import org.hibernate.Transaction;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.registry.StandardServiceRegistry;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/** Standalone Hibernate against a unique, disposable H2 database; no Spring or external service starts. */
class VehiclePersistenceTest {
    private static StandardServiceRegistry registry;
    private static SessionFactory sessions;

    @BeforeAll static void createEphemeralSchema() {
        registry = new StandardServiceRegistryBuilder()
            .applySetting("hibernate.connection.driver_class", "org.h2.Driver")
            .applySetting("hibernate.connection.url", "jdbc:h2:mem:owner-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1")
            .applySetting("hibernate.connection.username", "sa")
            .applySetting("hibernate.connection.password", "")
            .applySetting("hibernate.hbm2ddl.auto", "create-drop")
            .applySetting("hibernate.show_sql", "false")
            .build();
        try {
            sessions = new MetadataSources(registry)
                .addAnnotatedClass(Vehicle.class)
                .addAnnotatedClass(VehiclePhoto.class)
                .buildMetadata().buildSessionFactory();
        } catch (RuntimeException | Error failure) {
            StandardServiceRegistryBuilder.destroy(registry);
            registry = null;
            throw failure;
        }
    }

    @AfterAll static void dropEphemeralSchema() {
        try {
            if (sessions != null) sessions.close();
        } finally {
            if (registry != null) StandardServiceRegistryBuilder.destroy(registry);
        }
    }

    @Test void extendedColumnsAndPhotoRelationshipRoundTripWithDeclaredOrdering() {
        Vehicle v = vehicle();
        v.update(new VehicleRequest("Brand", "Model", 2022, new BigDecimal("24999.95"), 34567,
            "Petrol", "Automatic", 190, "Blue", "Detailed service history.", null));
        v.setArchived(true);
        VehiclePhoto later = photo(v, 9, false);
        VehiclePhoto firstAtOne = photo(v, 1, true);
        VehiclePhoto secondAtOne = photo(v, 1, false);
        inTransaction(session -> {
            session.persist(v);
            session.persist(later);
            session.persist(firstAtOne);
            session.persist(secondAtOne);
            return null;
        });

        inTransaction(session -> {
            Vehicle loaded = session.find(Vehicle.class, v.getId());
            assertEquals(v.getId(), loaded.getId());
            assertTrue(loaded.isArchived());
            assertEquals("Automatic", loaded.getTransmission());
            assertEquals(190, loaded.getEnginePowerHp());
            assertEquals("Blue", loaded.getColor());
            assertEquals("Detailed service history.", loaded.getDescription());
            assertEquals(new BigDecimal("24999.95"), loaded.getPrice());
            assertEquals(List.of(1, 1, 9), loaded.getPhotos().stream().map(VehiclePhoto::getPosition).toList());
            assertEquals(List.of(firstAtOne.getId(), secondAtOne.getId(), later.getId()),
                loaded.getPhotos().stream().map(VehiclePhoto::getId).toList());
            assertTrue(loaded.getPhotos().getFirst().isCover());
            for (VehiclePhoto item : loaded.getPhotos()) assertEquals(loaded.getId(), item.getVehicle().getId());
            return null;
        });
    }

    @Test void archiveAndRestoreKeepTheSamePersistentIdAndSoldLifecycle() {
        Vehicle v = vehicle();
        v.setStatus(VehicleStatus.SOLD);
        inTransaction(session -> { session.persist(v); return null; });
        Long originalId = v.getId();

        inTransaction(session -> {
            Vehicle loaded = session.find(Vehicle.class, originalId);
            assertFalse(loaded.isArchived());
            assertNull(loaded.getTransmission());
            assertNull(loaded.getEnginePowerHp());
            assertNull(loaded.getColor());
            assertNull(loaded.getDescription());
            loaded.setArchived(true);
            return null;
        });
        inTransaction(session -> {
            Vehicle loaded = session.find(Vehicle.class, originalId);
            assertTrue(loaded.isArchived());
            assertEquals(originalId, loaded.getId());
            assertEquals(VehicleStatus.SOLD, loaded.getStatus());
            loaded.setArchived(false);
            return null;
        });
        inTransaction(session -> {
            Vehicle loaded = session.find(Vehicle.class, originalId);
            assertFalse(loaded.isArchived());
            assertEquals(originalId, loaded.getId());
            assertEquals(VehicleStatus.SOLD, loaded.getStatus());
            return null;
        });
    }

    @Test void flushAdvancesVersionAndRejectsAStaleDetachedVehicle() {
        Vehicle stale = vehicle();
        inTransaction(session -> { session.persist(stale); return null; });
        Long originalVersion = stale.getVersion();
        assertNotNull(originalVersion);

        Long currentVersion = inTransaction(session -> {
            Vehicle current = session.find(Vehicle.class, stale.getId());
            current.setArchived(true);
            session.flush();
            assertEquals(originalVersion + 1, current.getVersion());
            return current.getVersion();
        });
        assertEquals(originalVersion, stale.getVersion(), "Detached form snapshot must retain its original version");
        assertNotEquals(currentVersion, stale.getVersion());

        RuntimeException failure = assertThrows(RuntimeException.class, () -> inTransaction(session -> {
            session.merge(stale);
            session.flush();
            return null;
        }));
        assertTrue(hasCause(failure, OptimisticLockException.class) || hasCause(failure, StaleStateException.class),
            "A stale update must fail through optimistic locking");
        inTransaction(session -> {
            Vehicle persisted = session.find(Vehicle.class, stale.getId());
            assertTrue(persisted.isArchived());
            assertEquals(currentVersion, persisted.getVersion());
            return null;
        });
    }

    @Test void photoForeignKeyPreventsPhysicalParentDeletionAndRollbackPreservesBothRows() {
        Vehicle v = vehicle();
        VehiclePhoto picture = photo(v, 0, true);
        inTransaction(session -> {
            session.persist(v);
            session.persist(picture);
            return null;
        });

        RuntimeException failure = assertThrows(RuntimeException.class, () -> inTransaction(session -> {
            session.remove(session.find(Vehicle.class, v.getId()));
            session.flush();
            return null;
        }));
        assertTrue(hasCause(failure, ConstraintViolationException.class),
            "Deleting a referenced vehicle must fail at the foreign key, without cascading to photos");
        inTransaction(session -> {
            assertNotNull(session.find(Vehicle.class, v.getId()));
            VehiclePhoto retained = session.find(VehiclePhoto.class, picture.getId());
            assertNotNull(retained);
            assertEquals(v.getId(), retained.getVehicle().getId());
            return null;
        });
    }

    private static <T> T inTransaction(Function<Session, T> work) {
        try (Session session = sessions.openSession()) {
            Transaction transaction = session.beginTransaction();
            try {
                T result = work.apply(session);
                transaction.commit();
                return result;
            } catch (RuntimeException | Error failure) {
                if (transaction.isActive()) transaction.rollback();
                throw failure;
            }
        }
    }

    private static boolean hasCause(Throwable failure, Class<? extends Throwable> expected) {
        for (Throwable current = failure; current != null; current = current.getCause()) {
            if (expected.isInstance(current)) return true;
        }
        return false;
    }

    private static Vehicle vehicle() {
        return new Vehicle("Brand", "Model", 2020, new BigDecimal("10000.00"), 50000, "Petrol");
    }

    private static VehiclePhoto photo(Vehicle vehicle, int position, boolean cover) {
        String stem = UUID.randomUUID().toString();
        return new VehiclePhoto(vehicle, stem + ".jpg", stem + "-thumb.jpg", position, cover);
    }
}
