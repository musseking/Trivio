package rs.trivio.vehicle;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

/** Unit tests use in-memory entities and a mock repository; no application or database starts. */
@ExtendWith(MockitoExtension.class)
class VehicleManagerTest {
    @Mock VehicleRepository repo;
    private VehicleManager manager;

    @BeforeEach void setUp() { manager = new VehicleManager(repo); }

    @Test void publicCatalogAndOwnerCatalogUseSeparateQueries() {
        Vehicle active = vehicle(VehicleStatus.AVAILABLE);
        Vehicle archived = vehicle(VehicleStatus.SOLD);
        archived.setArchived(true);
        when(repo.findByArchivedFalseOrderByIdDesc()).thenReturn(List.of(active));
        when(repo.findAllByOrderByIdDesc()).thenReturn(List.of(archived, active));

        assertEquals(1, manager.all().size());
        List<VehicleResponse> managed = manager.manageAll();
        assertEquals(2, managed.size());
        assertTrue(managed.getFirst().archived());
        verify(repo).findByArchivedFalseOrderByIdDesc();
        verify(repo).findAllByOrderByIdDesc();
        verify(repo, never()).findAll();
    }

    @Test void archivedVehicleRemainsReadableByIdForOrderHistory() {
        Vehicle v = vehicle(VehicleStatus.SOLD);
        v.setArchived(true);
        when(repo.findById(7L)).thenReturn(Optional.of(v));

        VehicleResponse result = manager.get(7L);

        assertTrue(result.archived());
        assertEquals(VehicleStatus.SOLD, result.status());
    }

    @Test void createKeepsLifecycleServerControlledAndSavesOptionalDetails() {
        when(repo.saveAndFlush(any(Vehicle.class))).thenAnswer(call -> {
            Vehicle v = call.getArgument(0);
            ReflectionTestUtils.setField(v, "id", 7L);
            ReflectionTestUtils.setField(v, "version", 0L);
            return v;
        });

        VehicleResponse result = manager.create(request(null));

        assertEquals(VehicleStatus.AVAILABLE, result.status());
        assertFalse(result.archived());
        assertEquals("Automatic", result.transmission());
        assertEquals(150, result.enginePowerHp());
        assertEquals("Blue", result.color());
        assertEquals("Service history available.", result.description());
        assertEquals(0L, result.version());
        assertTrue(result.photos().isEmpty());
    }

    @ParameterizedTest
    @EnumSource(value = VehicleStatus.class, names = {"AVAILABLE", "SOLD"})
    void archiveAndRestorePreserveLifecycle(VehicleStatus status) {
        Vehicle v = locked(status);

        VehicleResponse archived = manager.archive(7L);
        assertTrue(archived.archived());
        assertEquals(status, archived.status());
        VehicleResponse restored = manager.restore(7L);
        assertFalse(restored.archived());
        assertEquals(status, restored.status());
        verify(repo, times(2)).flush();
        verify(repo, never()).delete(any(Vehicle.class));
    }

    @Test void reservedVehicleCannotBeArchivedOrRestored() {
        Vehicle v = locked(VehicleStatus.RESERVED);

        conflict(() -> manager.archive(7L));
        conflict(() -> manager.restore(7L));

        assertFalse(v.isArchived());
        assertEquals(VehicleStatus.RESERVED, v.getStatus());
        verify(repo, never()).flush();
    }

    @Test void deleteWithdrawsAvailableVehicleWithoutDeletingTheRowOrItsReferences() {
        Vehicle v = locked(VehicleStatus.AVAILABLE);

        manager.delete(7L);

        assertTrue(v.isArchived());
        assertEquals(VehicleStatus.AVAILABLE, v.getStatus());
        verify(repo).findForUpdate(7L);
        verifyNoMoreInteractions(repo);
    }

    @ParameterizedTest
    @EnumSource(value = VehicleStatus.class, names = {"RESERVED", "SOLD"})
    void legacyDeleteRetainsAvailableOnlyRestriction(VehicleStatus status) {
        Vehicle v = locked(status);

        conflict(() -> manager.delete(7L));

        assertFalse(v.isArchived());
        assertEquals(status, v.getStatus());
        verify(repo, never()).delete(any(Vehicle.class));
    }

    @Test void archivedAvailableVehicleCannotBeReserved() {
        Vehicle v = locked(VehicleStatus.AVAILABLE);
        v.setArchived(true);

        conflict(() -> manager.reserve(7L));

        assertEquals(VehicleStatus.AVAILABLE, v.getStatus());
        assertTrue(v.isArchived());
    }

    @Test void updateRejectsStaleVersionWithoutModifyingTheVehicle() {
        Vehicle v = locked(VehicleStatus.AVAILABLE);

        conflict(() -> manager.update(7L, request(2L)));

        assertEquals("Original", v.getBrand());
        assertNull(v.getTransmission());
        verify(repo, never()).flush();
    }

    @Test void updateFlushesAndReturnsCurrentVersionWhilePreservingArchiveAndLifecycle() {
        Vehicle v = locked(VehicleStatus.AVAILABLE);
        v.setArchived(true);
        doAnswer(call -> {
            ReflectionTestUtils.setField(v, "version", 4L);
            return null;
        }).when(repo).flush();

        VehicleResponse result = manager.update(7L, request(3L));

        assertEquals("Updated", result.brand());
        assertEquals(4L, result.version());
        assertTrue(result.archived());
        assertEquals(VehicleStatus.AVAILABLE, result.status());
    }

    @Test void legacyUpdateWithoutVersionStillWorks() {
        locked(VehicleStatus.AVAILABLE);

        assertEquals("Updated", manager.update(7L, request(null)).brand());
        verify(repo).flush();
    }

    @ParameterizedTest
    @EnumSource(value = VehicleStatus.class, names = {"RESERVED", "SOLD"})
    void updateCannotChangeReservedOrSoldVehicle(VehicleStatus status) {
        Vehicle v = locked(status);

        conflict(() -> manager.update(7L, request(3L)));

        assertEquals("Original", v.getBrand());
        assertEquals(status, v.getStatus());
        verify(repo, never()).flush();
    }

    @Test void existingReservationReleaseAndSaleRulesArePreserved() {
        Vehicle v = locked(VehicleStatus.AVAILABLE);

        assertEquals(VehicleStatus.RESERVED, manager.reserve(7L).status());
        assertEquals(VehicleStatus.AVAILABLE, manager.release(7L).status());
        conflict(() -> manager.sell(7L));
        manager.reserve(7L);
        assertEquals(VehicleStatus.SOLD, manager.sell(7L).status());
        assertEquals(VehicleStatus.SOLD, v.getStatus());
    }

    private Vehicle locked(VehicleStatus status) {
        Vehicle v = vehicle(status);
        when(repo.findForUpdate(7L)).thenReturn(Optional.of(v));
        return v;
    }

    private Vehicle vehicle(VehicleStatus status) {
        Vehicle v = new Vehicle("Original", "Model", 2020, new BigDecimal("10000.00"), 50000, "Petrol");
        ReflectionTestUtils.setField(v, "id", 7L);
        ReflectionTestUtils.setField(v, "version", 3L);
        v.setStatus(status);
        return v;
    }

    private VehicleRequest request(Long version) {
        return new VehicleRequest("Updated", "Model", 2021, new BigDecimal("12000.50"), 45000,
            "Petrol", "Automatic", 150, "Blue", "Service history available.", version);
    }

    private void conflict(Runnable operation) {
        ResponseStatusException error = assertThrows(ResponseStatusException.class, operation::run);
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }
}
