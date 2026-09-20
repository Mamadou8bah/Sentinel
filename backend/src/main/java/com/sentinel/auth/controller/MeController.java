package com.sentinel.auth.controller;


import com.sentinel.auth.security.SentinelUserDetails;
import com.sentinel.auth.dto.MeResponse;
import com.sentinel.tenant.security.TenantApiKeyPrincipal;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me")
public class MeController {

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public MeResponse me(Authentication authentication) {
        Object principal = authentication.getPrincipal();
        if (principal instanceof SentinelUserDetails details) {
            return new MeResponse(
                    details.getUsername(),
                    details.getTenantCode(),
                    details.getTenantId(),
                    details.getAuthorities().stream().map(Object::toString).toList());
        }
        if (principal instanceof TenantApiKeyPrincipal apiKey) {
            return new MeResponse(
                    apiKey.getUsername(),
                    apiKey.getTenantCode(),
                    apiKey.getTenantId(),
                    apiKey.getAuthorities().stream().map(Object::toString).toList());
        }
        return new MeResponse(
                authentication.getName(),
                null,
                null,
                authentication.getAuthorities().stream().map(Object::toString).toList());
    }
}
