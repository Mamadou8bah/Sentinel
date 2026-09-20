package com.sentinel.customer.dto;

import jakarta.validation.constraints.NotBlank;

public record StartKycSessionRequest(@NotBlank String externalCustomerId) {}
