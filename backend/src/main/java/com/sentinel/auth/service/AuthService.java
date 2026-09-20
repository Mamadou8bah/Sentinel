package com.sentinel.auth.service;

import com.sentinel.auth.dto.AuthResponse;
import com.sentinel.auth.dto.LoginRequest;
import com.sentinel.auth.dto.RefreshRequest;
import com.sentinel.auth.model.RefreshToken;
import com.sentinel.auth.model.User;
import com.sentinel.auth.repository.RefreshTokenRepository;
import com.sentinel.auth.repository.UserRepository;
import com.sentinel.common.util.Hashing;
import com.sentinel.tenant.model.Tenant;
import com.sentinel.tenant.repository.TenantRepository;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final RefreshTokenRepository refreshTokenRepository;

    public AuthService(
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            UserRepository userRepository,
            TenantRepository tenantRepository,
            RefreshTokenRepository refreshTokenRepository) {
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.tenantRepository = tenantRepository;
        this.refreshTokenRepository = refreshTokenRepository;
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        Tenant tenant = tenantRepository
                .findByCode(request.tenantCode().trim())
                .orElseThrow(AuthService::invalidCredentials);

        if (!tenant.isEnabled()) {
            throw invalidCredentials();
        }

        User user = userRepository
                .findByTenant_IdAndUsername(tenant.getId(), request.username().trim())
                .orElseThrow(AuthService::invalidCredentials);

        if (!user.isEnabled() || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw invalidCredentials();
        }

        // Ensure tenant is initialized for JWT claims after flush
        user.getTenant().getCode();
        return issueTokens(user);
    }

    @Transactional
    public AuthResponse refresh(RefreshRequest request) {
        String hash = Hashing.sha256Hex(request.refreshToken());
        RefreshToken stored = refreshTokenRepository
                .findByTokenHashAndRevokedFalse(hash)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid refresh token"));

        if (stored.getExpiresAt().isBefore(Instant.now())) {
            stored.setRevoked(true);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token expired");
        }

        stored.setRevoked(true);
        User user = stored.getUser();
        if (!user.isEnabled() || !user.getTenant().isEnabled()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User disabled");
        }
        return issueTokens(user);
    }

    private AuthResponse issueTokens(User user) {
        String access = jwtService.createAccessToken(user);
        String refreshValue = jwtService.createRefreshTokenValue();

        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setUser(user);
        refreshToken.setTokenHash(Hashing.sha256Hex(refreshValue));
        refreshToken.setExpiresAt(jwtService.refreshExpiry());
        refreshTokenRepository.save(refreshToken);

        return new AuthResponse(
                access,
                refreshValue,
                "Bearer",
                jwtService.getAccessTokenExpiryMinutes(),
                user.getUsername(),
                user.getRole(),
                user.getTenant().getCode(),
                user.getTenant().getId());
    }

    private static BadCredentialsException invalidCredentials() {
        return new BadCredentialsException("Invalid tenant, username, or password");
    }
}
