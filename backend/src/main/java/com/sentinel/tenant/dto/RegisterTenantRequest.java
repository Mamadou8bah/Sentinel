package com.sentinel.tenant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterTenantRequest(
        @NotBlank @Size(min = 2, max = 64) @Pattern(regexp = "^[a-z0-9][a-z0-9-]{1,62}$") String code,
        @NotBlank @Size(max = 200) String name,
        @NotBlank @Size(min = 3, max = 64) String adminUsername,
        @NotBlank @Size(min = 8, max = 128) String adminPassword,
        @Size(max = 1024) String webhookUrl) {}
