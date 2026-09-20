package com.sentinel.customer.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record StartKycSessionRequest(
        @NotBlank String externalCustomerId,
        @Size(max = 1024) String returnUrl) {}
