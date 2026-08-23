package com.sentinel.risk;

import com.sentinel.tenant.Tenant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "risk_settings")
public class RiskSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false, unique = true)
    private Tenant tenant;

    @Column(name = "kyc_weight", nullable = false)
    private Double kycWeight = 0.35;

    @Column(name = "document_weight", nullable = false)
    private Double documentWeight = 0.40;

    @Column(name = "transaction_weight", nullable = false)
    private Double transactionWeight = 0.25;

    @Column(name = "signature_match_threshold", nullable = false)
    private Double signatureMatchThreshold = 0.85;

    @Column(name = "face_match_threshold", nullable = false)
    private Double faceMatchThreshold = 0.80;

    @Column(name = "tampering_threshold", nullable = false)
    private Double tamperingThreshold = 0.50;

    @Column(name = "anomaly_threshold", nullable = false)
    private Double anomalyThreshold = 0.70;

    @Column(name = "auto_flag_risk_score", nullable = false)
    private Integer autoFlagRiskScore = 60;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Tenant getTenant() {
        return tenant;
    }

    public void setTenant(Tenant tenant) {
        this.tenant = tenant;
    }

    public Double getKycWeight() {
        return kycWeight;
    }

    public void setKycWeight(Double kycWeight) {
        this.kycWeight = kycWeight;
    }

    public Double getDocumentWeight() {
        return documentWeight;
    }

    public void setDocumentWeight(Double documentWeight) {
        this.documentWeight = documentWeight;
    }

    public Double getTransactionWeight() {
        return transactionWeight;
    }

    public void setTransactionWeight(Double transactionWeight) {
        this.transactionWeight = transactionWeight;
    }

    public Double getSignatureMatchThreshold() {
        return signatureMatchThreshold;
    }

    public void setSignatureMatchThreshold(Double signatureMatchThreshold) {
        this.signatureMatchThreshold = signatureMatchThreshold;
    }

    public Double getFaceMatchThreshold() {
        return faceMatchThreshold;
    }

    public void setFaceMatchThreshold(Double faceMatchThreshold) {
        this.faceMatchThreshold = faceMatchThreshold;
    }

    public Double getTamperingThreshold() {
        return tamperingThreshold;
    }

    public void setTamperingThreshold(Double tamperingThreshold) {
        this.tamperingThreshold = tamperingThreshold;
    }

    public Double getAnomalyThreshold() {
        return anomalyThreshold;
    }

    public void setAnomalyThreshold(Double anomalyThreshold) {
        this.anomalyThreshold = anomalyThreshold;
    }

    public Integer getAutoFlagRiskScore() {
        return autoFlagRiskScore;
    }

    public void setAutoFlagRiskScore(Integer autoFlagRiskScore) {
        this.autoFlagRiskScore = autoFlagRiskScore;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
