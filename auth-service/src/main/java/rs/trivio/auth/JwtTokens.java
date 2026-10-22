package rs.trivio.auth;

import java.time.Duration;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;

@Service
public class JwtTokens {
    public static final long EXPIRES_IN_SECONDS = 3600;
    private final JwtEncoder encoder;
    public JwtTokens(JwtEncoder encoder) { this.encoder = encoder; }

    public String issue(UserAccount account) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
            .issuer("trivio-auth")
            .subject(account.getId().toString())
            .issuedAt(now)
            .expiresAt(now.plus(Duration.ofSeconds(EXPIRES_IN_SECONDS)))
            .claim("role", account.getRole().name())
            .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }
}
