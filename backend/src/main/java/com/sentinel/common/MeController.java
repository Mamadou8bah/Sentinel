package com.sentinel.common;

import com.sentinel.auth.SentinelUserDetails;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Smoke endpoint — proves JWT + RBAC + tenant wiring. */
@RestController
@RequestMapping("/api/me")
public class MeController {

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> me(Authentication authentication) {
        if (authentication.getPrincipal() instanceof SentinelUserDetails details) {
            return Map.of(
                    "username", details.getUsername(),
                    "tenantCode", details.getTenantCode(),
                    "tenantId", details.getTenantId(),
                    "authorities", details.getAuthorities().stream().map(Object::toString).toList());
        }
        return Map.of(
                "username", authentication.getName(),
                "authorities", authentication.getAuthorities().stream().map(Object::toString).toList());
    }
}
