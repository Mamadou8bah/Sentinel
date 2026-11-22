package com.sentinel.customer.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record StartKycSessionRequest(
        @NotBlank String externalCustomerId,
        @Size(max = 1024) String returnUrl,
        @Size(max = 255) String fullName) {
    public StartKycSessionRequest(String externalCustomerId, String returnUrl) {
        this(externalCustomerId, returnUrl, null);
    }
}
