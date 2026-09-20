package com.sentinel.customer.dto;

import jakarta.validation.constraints.NotBlank;

public record SubmitKycSessionRequest(
        @NotBlank String idImage, @NotBlank String selfieImage, String name) {}
