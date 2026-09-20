package com.sentinel.auth.dto;

import com.sentinel.auth.model.Role;

public record AuthResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long expiresInMinutes,
        String username,
        Role role,
        String tenantCode,
        Long tenantId) {}
