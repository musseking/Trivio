
package rs.trivio.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/auth/setup")
public class OwnerSetupController {

    private static final byte BOOTSTRAP_ID = 1;

    private final OwnerBootstrapRepository bootstrapRepository;
    private final UserAccountRepository users;
    private final PasswordEncoder passwordEncoder;
    private final String installationKey;

    public OwnerSetupController(
            OwnerBootstrapRepository bootstrapRepository,
            UserAccountRepository users,
            PasswordEncoder passwordEncoder,
            @Value("${TRIVIO_OWNER_SETUP_KEY:}") String installationKey
    ) {
        this.bootstrapRepository = bootstrapRepository;
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.installationKey = installationKey;
    }

    public record SetupStatusResponse(
            boolean setupAvailable
    ) {}

    public record OwnerSetupRequest(
            @NotBlank @Size(max = 80) String firstName,
            @NotBlank @Size(max = 80) String lastName,
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(min = 12, max = 128) String password,
            @NotBlank String setupKey
    ) {}

    @GetMapping("/status")
    @Transactional(readOnly = true)
    public SetupStatusResponse getSetupStatus() {

        OwnerBootstrap bootstrap = bootstrapRepository
                .findById(BOOTSTRAP_ID)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.SERVICE_UNAVAILABLE,
                        "Owner setup is not initialized"
                ));

        boolean available =
                !bootstrap.isCompleted()
                && !users.existsByRole(UserAccount.Role.OWNER);

        return new SetupStatusResponse(available);
    }

    @PostMapping("/owner")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public AuthController.UserView createOwner(
            @Valid @RequestBody OwnerSetupRequest request
    ) {

        verifyInstallationKey(request.setupKey());

        OwnerBootstrap bootstrap = bootstrapRepository
                .lockById(BOOTSTRAP_ID)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.SERVICE_UNAVAILABLE,
                        "Owner setup is not initialized"
                ));

        if (bootstrap.isCompleted()
                || users.existsByRole(UserAccount.Role.OWNER)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This installation already has an OWNER"
            );
        }

        String email = request.email()
                .trim()
                .toLowerCase(Locale.ROOT);

        if (users.existsByEmail(email)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Email is already registered"
            );
        }

        UserAccount owner = new UserAccount(
                request.firstName().trim(),
                request.lastName().trim(),
                email,
                passwordEncoder.encode(request.password())
        );

        owner.setRole(UserAccount.Role.OWNER);

        try {
            owner = users.saveAndFlush(owner);
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Owner account could not be created",
                    exception
            );
        }

        bootstrap.complete(owner.getId());
        bootstrapRepository.saveAndFlush(bootstrap);

        return AuthController.UserView.from(owner);
    }

    private void verifyInstallationKey(String providedKey) {

        if (installationKey == null
                || installationKey.isBlank()
                || installationKey.startsWith("replace_")) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Owner setup key is not configured"
            );
        }

        byte[] expected = installationKey.getBytes(
                StandardCharsets.UTF_8
        );

        byte[] provided = providedKey.getBytes(
                StandardCharsets.UTF_8
        );

        if (!MessageDigest.isEqual(expected, provided)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Invalid owner setup key"
            );
        }
    }
}
