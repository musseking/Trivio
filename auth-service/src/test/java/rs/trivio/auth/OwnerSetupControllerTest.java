
package rs.trivio.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OwnerSetupControllerTest {

    private static final String SETUP_KEY =
            "trivio-test-owner-setup-key";

    private static final String PASSWORD =
            "TestOwnerPassword2026!";

    @Mock
    private OwnerBootstrapRepository bootstrapRepository;

    @Mock
    private UserAccountRepository users;

    @Mock
    private PasswordEncoder passwordEncoder;

    private OwnerSetupController controller;

    @BeforeEach
    void setUp() {
        controller = new OwnerSetupController(
                bootstrapRepository,
                users,
                passwordEncoder,
                SETUP_KEY
        );
    }

    private OwnerSetupController.OwnerSetupRequest request(
            String key
    ) {
        return new OwnerSetupController.OwnerSetupRequest(
                "Test",
                "Owner",
                "owner@example.com",
                PASSWORD,
                key
        );
    }

    @Test
    void setupIsAvailableBeforeOwnerCreation() {
        OwnerBootstrap bootstrap = new OwnerBootstrap();

        when(bootstrapRepository.findById((byte) 1))
                .thenReturn(Optional.of(bootstrap));

        var result = controller.getSetupStatus();

        assertTrue(result.setupAvailable());
    }

    @Test
    void invalidInstallationKeyIsRejected() {
        var exception = assertThrows(
                ResponseStatusException.class,
                () -> controller.createOwner(
                        request("incorrect-key")
                )
        );

        assertEquals(
                HttpStatus.FORBIDDEN,
                exception.getStatusCode()
        );

        verifyNoInteractions(
                bootstrapRepository,
                users,
                passwordEncoder
        );
    }

    @Test
    void firstOwnerCanBeCreatedSuccessfully() {
        OwnerBootstrap bootstrap = new OwnerBootstrap();

        when(bootstrapRepository.lockById((byte) 1))
                .thenReturn(Optional.of(bootstrap));

        when(passwordEncoder.encode(PASSWORD))
                .thenReturn("encoded-test-password");

        when(users.saveAndFlush(any(UserAccount.class)))
                .thenAnswer(invocation -> {
                    UserAccount user = invocation.getArgument(0);

                    // Simulate an ID assigned by the database.
                    ReflectionTestUtils.setField(
                            user,
                            "id",
                            42L
                    );

                    return user;
                });

        var result = controller.createOwner(
                request(SETUP_KEY)
        );

        assertEquals(42L, result.id());
        assertEquals(
                UserAccount.Role.OWNER,
                result.role()
        );

        assertTrue(bootstrap.isCompleted());
        assertEquals(42L, bootstrap.getOwnerUserId());
        assertNotNull(bootstrap.getCompletedAt());

        verify(bootstrapRepository)
                .saveAndFlush(bootstrap);
    }

    @Test
    void secondOwnerIsRejectedAfterSetupCompletion() {
        OwnerBootstrap bootstrap = new OwnerBootstrap();
        bootstrap.complete(42L);

        when(bootstrapRepository.lockById((byte) 1))
                .thenReturn(Optional.of(bootstrap));

        var exception = assertThrows(
                ResponseStatusException.class,
                () -> controller.createOwner(
                        request(SETUP_KEY)
                )
        );

        assertEquals(
                HttpStatus.CONFLICT,
                exception.getStatusCode()
        );

        verify(users, never())
                .saveAndFlush(any(UserAccount.class));
    }

    @Test
    void existingOwnerPreventsBootstrap() {
        OwnerBootstrap bootstrap = new OwnerBootstrap();

        when(bootstrapRepository.lockById((byte) 1))
                .thenReturn(Optional.of(bootstrap));

        when(users.existsByRole(UserAccount.Role.OWNER))
                .thenReturn(true);

        var exception = assertThrows(
                ResponseStatusException.class,
                () -> controller.createOwner(
                        request(SETUP_KEY)
                )
        );

        assertEquals(
                HttpStatus.CONFLICT,
                exception.getStatusCode()
        );

        verify(users, never())
                .saveAndFlush(any(UserAccount.class));
    }
}
