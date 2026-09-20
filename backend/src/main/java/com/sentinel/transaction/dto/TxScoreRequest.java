package com.sentinel.transaction.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;

public record TxScoreRequest(
        @NotBlank String externalCustomerId,
        @NotBlank String externalTransactionId,
        @NotNull @DecimalMin("0.01") BigDecimal amount,
        String currency,
        Instant timestamp,
        String channel,
        String location,
        String counterparty) {}
