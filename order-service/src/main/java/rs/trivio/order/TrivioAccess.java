package rs.trivio.order;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

/** Authentication is delegated to auth-service /auth/me ON EVERY request.
 * The auth service checks signature, expiry, enabled status and live database role.
 * Never trust client-supplied customer id, email, or role fields.
 */
@Component
public class TrivioAccess {
    private final RestClient http = RestClient.create();
    private final String authUrl;
    private final String internalKey;

    public TrivioAccess(@Value("${TRIVIO_AUTH_URL:http://localhost:8084}") String authUrl,
                        @Value("${TRIVIO_INTERNAL_API_KEY:}") String internalKey) {
        this.authUrl = authUrl.replaceAll("/+$", "");
        this.internalKey = internalKey;
    }

    public record User(Long id, String firstName, String lastName, String email, String role,
                       boolean enabled) {
        public boolean privileged() { return "ADMIN".equals(role) || "OWNER".equals(role); }
        public String fullName() { return firstName + " " + lastName; }
    }

    public User user(String authorization) {
        if (authorization == null || !authorization.regionMatches(true, 0, "Bearer ", 0, 7)
            || authorization.substring(7).isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Bearer token required");
        }
        User u;
        try {
            u = http.get().uri(authUrl + "/auth/me")
                .header(HttpHeaders.AUTHORIZATION, authorization)
                .retrieve().body(User.class);
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() == 401)
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired token");
            if (e.getStatusCode().value() == 403)
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account access denied");
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Auth service unavailable");
        } catch (RestClientException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Auth service unavailable");
        }
        if (u == null || u.id() == null || !u.enabled() || u.email() == null || u.role() == null)
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account is unavailable");
        if (!("CUSTOMER".equals(u.role()) || u.privileged()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Unsupported user role");
        return u;
    }

    public User privileged(String authorization) {
        User u = user(authorization);
        if (!u.privileged()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "ADMIN or OWNER required");
        return u;
    }

    /** Require a separately generated, non-public credential for internal state transitions. */
    public void internal(String presented) {
        if (internalKey.length() < 43 || presented == null ||
            !MessageDigest.isEqual(internalKey.getBytes(StandardCharsets.UTF_8),
                                   presented.getBytes(StandardCharsets.UTF_8))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Internal service authorization required");
        }
    }

    public String keyForServiceCall() {
        if (internalKey.length() < 43)
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Internal service credential missing");
        return internalKey;
    }
}
