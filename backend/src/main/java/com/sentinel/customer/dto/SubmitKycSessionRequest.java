package com.sentinel.customer.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public record SubmitKycSessionRequest(
        @NotBlank String challengeId,
        @NotBlank @Size(max = 4000100) String idImage,
        @NotBlank @Size(max = 4000100) String selfieImage,
        @Size(max = 255) String name,
        @Size(max = 12) List<@NotBlank @Size(max = 4000100) String> frames) {}
