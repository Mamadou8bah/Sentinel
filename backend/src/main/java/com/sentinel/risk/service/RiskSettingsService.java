package com.sentinel.risk.service;


import com.sentinel.risk.model.RiskSettings;
import com.sentinel.risk.repository.RiskSettingsRepository;
import com.sentinel.audit.service.AuditService;
import com.sentinel.common.util.TenantAccess;
import com.sentinel.risk.dto.RiskSettingsRequest;
import com.sentinel.risk.dto.RiskSettingsResponse;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RiskSettingsService {

    private final RiskEngine riskEngine;
    private final RiskSettingsRepository riskSettingsRepository;
    private final AuditService auditService;

    public RiskSettingsService(
            RiskEngine riskEngine, RiskSettingsRepository riskSettingsRepository, AuditService auditService) {
        this.riskEngine = riskEngine;
        this.riskSettingsRepository = riskSettingsRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public RiskSettingsResponse get(Long tenantId) {
        return RiskSettingsResponse.from(riskEngine.requireSettings(tenantId));
    }

    @Transactional
    public RiskSettingsResponse update(Long tenantId, RiskSettingsRequest request) {
        RiskSettings settings = riskEngine.requireSettings(tenantId);
        RiskSettingsResponse before = RiskSettingsResponse.from(settings);

        settings.setKycWeight(request.kycWeight());
        settings.setDocumentWeight(request.documentWeight());
        settings.setTransactionWeight(request.transactionWeight());
        settings.setFaceMatchThreshold(request.faceMatchThreshold());
        settings.setSignatureMatchThreshold(request.signatureMatchThreshold());
        settings.setTamperingThreshold(request.tamperingThreshold());
        settings.setAnomalyThreshold(request.anomalyThreshold());
        settings.setAutoFlagRiskScore(request.autoFlagRiskScore());
        riskSettingsRepository.save(settings);

        RiskSettingsResponse after = RiskSettingsResponse.from(settings);
        auditService.record(
                tenantId,
                TenantAccess.currentUserIdOrNull(),
                "RISK_SETTINGS_UPDATE",
                "RiskSettings",
                settings.getId().toString(),
                Map.of(
                        "kycWeight", before.kycWeight(),
                        "documentWeight", before.documentWeight(),
                        "transactionWeight", before.transactionWeight()),
                Map.of(
                        "kycWeight", after.kycWeight(),
                        "documentWeight", after.documentWeight(),
                        "transactionWeight", after.transactionWeight()));
        return after;
    }
}
