package com.sentinel.common.util;

import com.sentinel.auth.security.SentinelUserDetails;
import com.sentinel.tenant.security.TenantApiKeyPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

/** Resolves the authenticated tenant for staff JWT or bank API-key calls. */
public final class TenantAccess {

    private TenantAccess() {}

    public static Authentication requireAuthentication() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        return auth;
    }

    public static Long requireTenantId() {
        Authentication auth = requireAuthentication();
        Object principal = auth.getPrincipal();
        if (principal instanceof SentinelUserDetails details) {
            return details.getTenantId();
        }
        if (principal instanceof TenantApiKeyPrincipal apiKey) {
            return apiKey.getTenantId();
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unknown principal");
    }

    public static Long currentUserIdOrNull() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return null;
        }
        Object principal = auth.getPrincipal();
        if (principal instanceof SentinelUserDetails details) {
            return details.getUserId();
        }
        return null;
    }

    public static SentinelUserDetails requireStaff() {
        Authentication auth = requireAuthentication();
        if (auth.getPrincipal() instanceof SentinelUserDetails details) {
            return details;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff JWT required");
    }
}
