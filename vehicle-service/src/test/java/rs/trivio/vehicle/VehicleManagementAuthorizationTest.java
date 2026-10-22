package rs.trivio.vehicle;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InOrder;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Authorization tests do not call Auth Service or start Spring. */
class VehicleManagementAuthorizationTest {
    private static final String BEARER = "Bearer fixture-token";

    @ParameterizedTest
    @ValueSource(strings = {"CUSTOMER", "ADMIN"})
    void ownerCheckRejectsEveryNonOwnerAfterResolvingAuthenticatedIdentity(String role) {
        TrivioAccess access = spy(new TrivioAccess("http://unused.invalid", ""));
        doReturn(user(role)).when(access).user(BEARER);

        ResponseStatusException error = assertThrows(ResponseStatusException.class, () -> access.owner(BEARER));

        assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
        verify(access).user(BEARER);
    }

    @Test void ownerCheckUsesTheLiveAuthenticatedIdentity() {
        TrivioAccess access = spy(new TrivioAccess("http://unused.invalid", ""));
        TrivioAccess.User owner = user("OWNER");
        doReturn(owner).when(access).user(BEARER);

        assertSame(owner, access.owner(BEARER));
        verify(access).user(BEARER);
    }

    @Test void ownerCheckRequiresABearerTokenWithoutSendingAnAnonymousNetworkRequest() {
        TrivioAccess access = new TrivioAccess("http://unused.invalid", "");

        ResponseStatusException error = assertThrows(ResponseStatusException.class, () -> access.owner(null));

        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
    }

    @Test void ownerRoutesAuthorizeBeforeAnyManagementAction() {
        VehicleManager manager = mock(VehicleManager.class);
        TrivioAccess access = mock(TrivioAccess.class);
        VehicleController controller = new VehicleController(manager, access);
        when(access.owner(BEARER)).thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN));

        assertThrows(ResponseStatusException.class, () -> controller.manage(BEARER));
        assertThrows(ResponseStatusException.class, () -> controller.archive(7L, BEARER));
        assertThrows(ResponseStatusException.class, () -> controller.restore(7L, BEARER));

        verifyNoInteractions(manager);
    }

    @Test void ownerMayListArchiveAndRestore() {
        VehicleManager manager = mock(VehicleManager.class);
        TrivioAccess access = mock(TrivioAccess.class);
        VehicleController controller = new VehicleController(manager, access);
        when(manager.manageAll()).thenReturn(List.of());

        assertTrue(controller.manage(BEARER).isEmpty());
        controller.archive(7L, BEARER);
        controller.restore(7L, BEARER);

        InOrder order = inOrder(access, manager);
        order.verify(access).owner(BEARER);
        order.verify(manager).manageAll();
        order.verify(access).owner(BEARER);
        order.verify(manager).archive(7L);
        order.verify(access).owner(BEARER);
        order.verify(manager).restore(7L);
    }

    @Test void existingCreateUpdateAndWithdrawalStillUsePrivilegedAuthorization() {
        VehicleManager manager = mock(VehicleManager.class);
        TrivioAccess access = mock(TrivioAccess.class);
        VehicleController controller = new VehicleController(manager, access);
        VehicleRequest request = new VehicleRequest("Brand", "Model", 2020, new BigDecimal("10000"),
            50000, "Petrol", null, null, null, null, null);

        controller.create(request, BEARER);
        controller.update(7L, request, BEARER);
        controller.delete(7L, BEARER);

        verify(access, times(3)).privileged(BEARER);
        verify(access, never()).owner(BEARER);
        verify(manager).create(request);
        verify(manager).update(7L, request);
        verify(manager).delete(7L);
    }

    private TrivioAccess.User user(String role) {
        return new TrivioAccess.User(1L, "Fixture", "User", "fixture@example.test", role, true);
    }
}
