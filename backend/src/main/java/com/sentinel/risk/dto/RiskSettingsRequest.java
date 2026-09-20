package com.sentinel.risk.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record RiskSettingsRequest(
        @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double kycWeight,
        @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double documentWeight,
        @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double transactionWeight,
        @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double faceMatchThreshold,
        @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double signatureMatchThreshold,
        @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double tamperingThreshold,
        @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double anomalyThreshold,
        @NotNull @Min(0) @Max(100) Integer autoFlagRiskScore) {}
