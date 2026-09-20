package com.sentinel.risk.service;


import com.sentinel.risk.model.RiskSettings;
import com.sentinel.risk.repository.RiskSettingsRepository;
import com.sentinel.customer.model.Customer;
import com.sentinel.customer.model.KycStatus;
import com.sentinel.document.model.Document;
import com.sentinel.document.model.SignatureMatchStatus;
import com.sentinel.transaction.model.TxRecommendation;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RiskEngine {

    private final RiskSettingsRepository riskSettingsRepository;

    public RiskEngine(RiskSettingsRepository riskSettingsRepository) {
        this.riskSettingsRepository = riskSettingsRepository;
    }

    @Transactional(readOnly = true)
    public RiskSettings requireSettings(Long tenantId) {
        return riskSettingsRepository
                .findByTenant_Id(tenantId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.INTERNAL_SERVER_ERROR, "Risk settings missing for tenant"));
    }

    public KycStatus decideKycStatus(double faceMatch, double liveness, RiskSettings settings) {
        if (faceMatch < settings.getFaceMatchThreshold() * 0.75 || liveness < 0.45) {
            return KycStatus.REJECTED;
        }
        if (faceMatch < settings.getFaceMatchThreshold() || liveness < 0.65) {
            return KycStatus.FLAGGED;
        }
        return KycStatus.VERIFIED;
    }

    /** 0–100 overall risk; higher = more concerning. */
    public int computeCustomerRisk(Customer customer, List<Document> documents, Double latestAnomaly) {
        RiskSettings settings = requireSettings(customer.getTenant().getId());

        double kycComponent = kycRiskComponent(customer);
        double docComponent = documentRiskComponent(documents, settings);
        double txComponent = latestAnomaly == null ? 0.2 : clamp01(latestAnomaly);

        double weighted = settings.getKycWeight() * kycComponent
                + settings.getDocumentWeight() * docComponent
                + settings.getTransactionWeight() * txComponent;
        return (int) Math.round(clamp01(weighted) * 100.0);
    }

    public boolean shouldOpenCase(int riskScore, RiskSettings settings) {
        return riskScore >= settings.getAutoFlagRiskScore();
    }

    public TxRecommendation recommendationFromAnomaly(double anomalyScore, RiskSettings settings) {
        if (anomalyScore >= Math.min(0.95, settings.getAnomalyThreshold() + 0.2)) {
            return TxRecommendation.BLOCK;
        }
        if (anomalyScore >= settings.getAnomalyThreshold()) {
            return TxRecommendation.REVIEW;
        }
        return TxRecommendation.ALLOW;
    }

    public String explainKyc(Customer customer, RiskSettings settings) {
        return "Face match %.2f (threshold %.2f); liveness %.2f; status %s"
                .formatted(
                        nz(customer.getFaceMatchScore()),
                        settings.getFaceMatchThreshold(),
                        nz(customer.getLivenessScore()),
                        customer.getKycStatus());
    }

    public String explainDocument(Document doc, RiskSettings settings) {
        List<String> parts = new ArrayList<>();
        parts.add("Tampering %.2f (threshold %.2f)".formatted(nz(doc.getTamperingScore()), settings.getTamperingThreshold()));
        if (doc.getSignatureMatchStatus() == SignatureMatchStatus.SKIPPED_NO_REFERENCE) {
            parts.add("Signature match skipped — no enrolled specimen");
        } else if (doc.getSignatureMatchStatus() == SignatureMatchStatus.SCORED) {
            parts.add("Signature match %.2f (threshold %.2f)"
                    .formatted(nz(doc.getSignatureMatchScore()), settings.getSignatureMatchThreshold()));
        }
        if (doc.getFieldConsistencyFlags() != null && !doc.getFieldConsistencyFlags().isEmpty()) {
            parts.add("Flags: " + String.join(", ", doc.getFieldConsistencyFlags()));
        }
        return String.join("; ", parts);
    }

    private static double kycRiskComponent(Customer customer) {
        return switch (customer.getKycStatus()) {
            case REJECTED -> 1.0;
            case FLAGGED -> 0.75;
            case PENDING -> 0.45;
            case VERIFIED -> Math.max(0.05, 1.0 - average(customer.getFaceMatchScore(), customer.getLivenessScore()));
        };
    }

    private static double documentRiskComponent(List<Document> documents, RiskSettings settings) {
        if (documents == null || documents.isEmpty()) {
            return 0.15;
        }
        double max = 0;
        for (Document d : documents) {
            double tamper = nz(d.getTamperingScore());
            double sigRisk = 0;
            if (d.getSignatureMatchStatus() == SignatureMatchStatus.SCORED) {
                sigRisk = 1.0 - nz(d.getSignatureMatchScore());
            } else if (d.getSignatureMatchStatus() == SignatureMatchStatus.SKIPPED_NO_REFERENCE) {
                sigRisk = 0.35;
            }
            double fraud = d.getFraudRiskScore() != null ? d.getFraudRiskScore() : Math.max(tamper, sigRisk);
            max = Math.max(max, fraud);
            if (tamper >= settings.getTamperingThreshold()) {
                max = Math.max(max, 0.85);
            }
        }
        return clamp01(max);
    }

    private static double average(Double a, Double b) {
        if (a == null && b == null) {
            return 0.5;
        }
        if (a == null) {
            return b;
        }
        if (b == null) {
            return a;
        }
        return (a + b) / 2.0;
    }

    private static double nz(Double v) {
        return v == null ? 0.0 : v;
    }

    private static double clamp01(double v) {
        return Math.max(0.0, Math.min(1.0, v));
    }
}
