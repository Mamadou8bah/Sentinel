package com.sentinel.document.dto;

import com.sentinel.document.model.Document;
import com.sentinel.document.model.DocumentStatus;
import com.sentinel.document.model.DocumentType;
import com.sentinel.document.model.SignatureMatchStatus;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public record DocumentResponse(
        Long id,
        Long customerId,
        DocumentType type,
        DocumentStatus status,
        Double tamperingScore,
        SignatureMatchStatus signatureMatchStatus,
        Double signatureMatchScore,
        Double fraudRiskScore,
        List<String> fieldConsistencyFlags,
        Map<String, Object> ocrExtractedData,
        Instant createdAt) {

    public static DocumentResponse from(Document doc) {
        return new DocumentResponse(
                doc.getId(),
                doc.getCustomer().getId(),
                doc.getType(),
                doc.getStatus(),
                doc.getTamperingScore(),
                doc.getSignatureMatchStatus(),
                doc.getSignatureMatchScore(),
                doc.getFraudRiskScore(),
                doc.getFieldConsistencyFlags(),
                doc.getOcrExtractedData(),
                doc.getCreatedAt());
    }
}
