package rs.trivio.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/auth")
public class AuthController {
    private final UserAccountRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokens tokens;

    public AuthController(UserAccountRepository users, PasswordEncoder passwordEncoder, JwtTokens tokens) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.tokens = tokens;
    }

    public record RegisterRequest(
        @NotBlank @Size(max = 80) String firstName,
        @NotBlank @Size(max = 80) String lastName,
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(min = 12, max = 128) String password) {}
    public record LoginRequest(@NotBlank String email, @NotBlank String password) {}
    public record TokenResponse(String accessToken, String tokenType, long expiresIn) {}
    public record UserView(Long id, String firstName, String lastName, String email,
                           UserAccount.Role role, boolean enabled, Instant createdAt) {
        public static UserView from(UserAccount u) {
            return new UserView(u.getId(), u.getFirstName(), u.getLastName(), u.getEmail(),
                                u.getRole(), u.isEnabled(), u.getCreatedAt());
        }
    }
    public record ChangeRoleRequest(@NotBlank String role) {}

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public UserView register(@Valid @RequestBody RegisterRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmail(email)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already registered");
        UserAccount user = new UserAccount(request.firstName().trim(), request.lastName().trim(),
            email, passwordEncoder.encode(request.password()));
        // Public registration NEVER accepts or assigns ADMIN / OWNER roles.
        try { return UserView.from(users.saveAndFlush(user)); }
        catch (DataIntegrityViolationException e) { throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already registered"); }
    }

    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        UserAccount account = users.findByEmail(email).orElse(null);
        if (account == null || !account.isEnabled() || !passwordEncoder.matches(request.password(), account.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }
        return new TokenResponse(tokens.issue(account), "Bearer", JwtTokens.EXPIRES_IN_SECONDS);
    }

    @GetMapping("/me")
    @Transactional(readOnly = true)
    public UserView me(@AuthenticationPrincipal Jwt jwt) {
        return UserView.from(currentUser(jwt));
    }

    @GetMapping("/admin/users")
    @Transactional(readOnly = true)
    public List<UserView> listUsers(@AuthenticationPrincipal Jwt jwt) {
        requireOwner(jwt);
        return users.findAll().stream().map(UserView::from).toList();
    }

    @PutMapping("/admin/users/{id}/role")
    @Transactional
    public UserView updateRole(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
                               @Valid @RequestBody ChangeRoleRequest request) {
        requireOwner(jwt);
        UserAccount.Role role;
        try { role = UserAccount.Role.valueOf(request.role().trim().toUpperCase(Locale.ROOT)); }
        catch (IllegalArgumentException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown role"); }
        if (role == UserAccount.Role.OWNER) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "OWNER cannot be granted via API");
        UserAccount target = users.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        if (target.getRole() == UserAccount.Role.OWNER) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot modify OWNER");
        target.setRole(role);
        return UserView.from(users.save(target));
    }

    private UserAccount currentUser(Jwt jwt) {
        Long id;
        try { id = Long.valueOf(jwt.getSubject()); }
        catch (NumberFormatException e) { throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid account"); }
        UserAccount user = users.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account unavailable"));
        if (!user.isEnabled()) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account disabled");
        return user;
    }

    private void requireOwner(Jwt jwt) {
        // Check the DATABASE role, not potentially stale role claims inside a JWT.
        if (currentUser(jwt).getRole() != UserAccount.Role.OWNER)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "OWNER required");
    }
}
