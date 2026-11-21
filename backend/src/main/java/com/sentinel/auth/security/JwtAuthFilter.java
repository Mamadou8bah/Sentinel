package com.sentinel.auth.security;

import com.sentinel.auth.service.JwtService;
import com.sentinel.auth.service.SentinelUserDetailsService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final SentinelUserDetailsService userDetailsService;
    private final com.sentinel.platform.PlatformAccountRepository platformAccounts;

    public JwtAuthFilter(JwtService jwtService, SentinelUserDetailsService userDetailsService,
            com.sentinel.platform.PlatformAccountRepository platformAccounts) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
        this.platformAccounts = platformAccounts;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        // Integration routes authenticate exclusively via X-Api-Key
        return path != null && path.startsWith("/api/integration/");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (SecurityContextHolder.getContext().getAuthentication() != null) {
            filterChain.doFilter(request, response);
            return;
        }

        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = header.substring(7);
        try {
            Claims claims = jwtService.parseAccessToken(token);
            if ("platform".equals(claims.get("scope"))) {
                if (request.getRequestURI().startsWith("/api/platform/")) {
                    var account = platformAccounts.findById(claims.get("uid", Number.class).longValue()).orElseThrow();
                    if (account.isEnabled() && account.getUsername().equals(claims.getSubject())
                            && account.getSessionVersion() == claims.get("sv", Number.class).longValue()) {
                        var principal = new com.sentinel.platform.PlatformPrincipal(account.getId(), account.getUsername());
                        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                                principal, null, java.util.List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_PLATFORM_ADMIN"))));
                    }
                }
            } else if (claims.get("scope") == null) {
                Long tenantId = JwtService.tenantIdFrom(claims);
                String username = claims.getSubject();
                if (tenantId != null && username != null) {
                    UserDetails userDetails = userDetailsService.loadUserByTenantIdAndUsername(tenantId, username);
                    long version = claims.get("av", Number.class) == null ? 0 : claims.get("av", Number.class).longValue();
                    if (userDetails instanceof SentinelUserDetails staff && staff.getUser().getAuthVersion() != version)
                        throw new IllegalArgumentException("Revoked session");
                    var auth = new UsernamePasswordAuthenticationToken(
                            userDetails, null, userDetails.getAuthorities());
                    auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            }
        } catch (Exception ignored) {
            // Invalid token → leave context empty; SecurityFilterChain rejects protected routes
        }

        filterChain.doFilter(request, response);
    }
}
