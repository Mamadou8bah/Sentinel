package com.sentinel.document;

import com.sentinel.customer.Customer;
import com.sentinel.tenant.Tenant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "documents")
public class Document {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private DocumentType type;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "ocr_extracted_data")
    private Map<String, Object> ocrExtractedData;

    @Enumerated(EnumType.STRING)
    @Column(name = "signature_match_status", nullable = false, length = 32)
    private SignatureMatchStatus signatureMatchStatus = SignatureMatchStatus.PENDING;

    @Column(name = "signature_match_score")
    private Double signatureMatchScore;

    @Column(name = "tampering_score")
    private Double tamperingScore;

    @Column(name = "fraud_risk_score")
    private Double fraudRiskScore;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "field_consistency_flags")
    private List<String> fieldConsistencyFlags;

    @Column(name = "image_url", length = 1024)
    private String imageUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private DocumentStatus status = DocumentStatus.PENDING;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

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

    public Customer getCustomer() {
        return customer;
    }

    public void setCustomer(Customer customer) {
        this.customer = customer;
    }

    public DocumentType getType() {
        return type;
    }

    public void setType(DocumentType type) {
        this.type = type;
    }

    public Map<String, Object> getOcrExtractedData() {
        return ocrExtractedData;
    }

    public void setOcrExtractedData(Map<String, Object> ocrExtractedData) {
        this.ocrExtractedData = ocrExtractedData;
    }

    public SignatureMatchStatus getSignatureMatchStatus() {
        return signatureMatchStatus;
    }

    public void setSignatureMatchStatus(SignatureMatchStatus signatureMatchStatus) {
        this.signatureMatchStatus = signatureMatchStatus;
    }

    public Double getSignatureMatchScore() {
        return signatureMatchScore;
    }

    public void setSignatureMatchScore(Double signatureMatchScore) {
        this.signatureMatchScore = signatureMatchScore;
    }

    public Double getTamperingScore() {
        return tamperingScore;
    }

    public void setTamperingScore(Double tamperingScore) {
        this.tamperingScore = tamperingScore;
    }

    public Double getFraudRiskScore() {
        return fraudRiskScore;
    }

    public void setFraudRiskScore(Double fraudRiskScore) {
        this.fraudRiskScore = fraudRiskScore;
    }

    public List<String> getFieldConsistencyFlags() {
        return fieldConsistencyFlags;
    }

    public void setFieldConsistencyFlags(List<String> fieldConsistencyFlags) {
        this.fieldConsistencyFlags = fieldConsistencyFlags;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public DocumentStatus getStatus() {
        return status;
    }

    public void setStatus(DocumentStatus status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
