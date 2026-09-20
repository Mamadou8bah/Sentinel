package com.sentinel.risk.dto;

import com.sentinel.risk.model.RiskSettings;
import java.time.Instant;

public record RiskSettingsResponse(
        Double kycWeight,
        Double documentWeight,
        Double transactionWeight,
        Double faceMatchThreshold,
        Double signatureMatchThreshold,
        Double tamperingThreshold,
        Double anomalyThreshold,
        Integer autoFlagRiskScore,
        Instant updatedAt) {

    public static RiskSettingsResponse from(RiskSettings s) {
        return new RiskSettingsResponse(
                s.getKycWeight(),
                s.getDocumentWeight(),
                s.getTransactionWeight(),
                s.getFaceMatchThreshold(),
                s.getSignatureMatchThreshold(),
                s.getTamperingThreshold(),
                s.getAnomalyThreshold(),
                s.getAutoFlagRiskScore(),
                s.getUpdatedAt());
    }
}
