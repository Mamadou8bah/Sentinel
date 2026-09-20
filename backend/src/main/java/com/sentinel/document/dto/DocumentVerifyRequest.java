package com.sentinel.document.dto;

import com.sentinel.document.model.DocumentType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record DocumentVerifyRequest(
        @NotBlank String externalCustomerId,
        @NotNull DocumentType docType,
        @NotBlank String documentImage) {}
