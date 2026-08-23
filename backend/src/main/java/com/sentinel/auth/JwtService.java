package com.sentinel.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    private final JwtProperties properties;
    private final SecretKey key;

    public JwtService(JwtProperties properties) {
        this.properties = properties;
        byte[] secretBytes = properties.getSecret().getBytes(StandardCharsets.UTF_8);
        if (secretBytes.length < 32) {
            // Pad for local/dev secrets shorter than HS256 minimum
            byte[] padded = new byte[32];
            System.arraycopy(secretBytes, 0, padded, 0, Math.min(secretBytes.length, 32));
            this.key = Keys.hmacShaKeyFor(padded);
        } else {
            this.key = Keys.hmacShaKeyFor(secretBytes);
        }
    }

    public String createAccessToken(User user) {
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(properties.getAccessTokenExpiryMinutes() * 60);
        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject(user.getUsername())
                .claim("uid", user.getId())
                .claim("role", user.getRole().name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                .signWith(key)
                .compact();
    }

    public String createRefreshTokenValue() {
        return UUID.randomUUID() + "." + UUID.randomUUID();
    }

    public Instant refreshExpiry() {
        return Instant.now().plusSeconds(properties.getRefreshTokenExpiryDays() * 24 * 3600);
    }

    public Claims parseAccessToken(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public long getAccessTokenExpiryMinutes() {
        return properties.getAccessTokenExpiryMinutes();
    }
}
