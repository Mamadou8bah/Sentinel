package com.sentinel.customer.dto;

import jakarta.validation.constraints.NotBlank;

public record SpecimenRequest(@NotBlank String signatureImage) {}
