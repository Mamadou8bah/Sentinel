package com.sentinel.tenant.dto;

public record RegisterTenantResponse(
        Long tenantId,
        String code,
        String name,
        String adminUsername,
        /** Shown once — store in the bank backend vault. */
        String apiKey,
        String message) {}
