package com.sentinel.tenant.security;


import com.sentinel.tenant.model.TenantApiKey;
import com.sentinel.tenant.repository.TenantApiKeyRepository;
import com.sentinel.common.util.Hashing;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class ApiKeyAuthFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Api-Key";

    private final TenantApiKeyRepository apiKeyRepository;

    public ApiKeyAuthFilter(TenantApiKeyRepository apiKeyRepository) {
        this.apiKeyRepository = apiKeyRepository;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path == null || !path.startsWith("/api/integration/");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String rawKey = request.getHeader(HEADER);
        if (rawKey == null || rawKey.isBlank()) {
            response.sendError(HttpStatus.UNAUTHORIZED.value(), "Missing X-Api-Key");
            return;
        }

        String prefix = rawKey.length() >= 12 ? rawKey.substring(0, 12) : rawKey;
        String hash = Hashing.sha256Hex(rawKey);
        List<TenantApiKey> candidates = apiKeyRepository.findByKeyPrefixAndEnabledTrue(prefix);
        TenantApiKey matched = candidates.stream()
                .filter(k -> hash.equals(k.getKeyHash()))
                .findFirst()
                .orElse(null);

        if (matched == null || !matched.getTenant().isEnabled()) {
            response.sendError(HttpStatus.UNAUTHORIZED.value(), "Invalid API key");
            return;
        }

        matched.setLastUsedAt(Instant.now());
        apiKeyRepository.save(matched);

        TenantApiKeyPrincipal principal = new TenantApiKeyPrincipal(matched);
        var auth = new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);

        filterChain.doFilter(request, response);
    }
}
