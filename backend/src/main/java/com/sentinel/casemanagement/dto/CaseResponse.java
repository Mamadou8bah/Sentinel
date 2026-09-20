package com.sentinel.casemanagement.dto;

import com.sentinel.casemanagement.model.CaseDecision;
import com.sentinel.casemanagement.model.CaseEntity;
import com.sentinel.casemanagement.model.CaseStatus;
import java.time.Instant;

public record CaseResponse(
        Long id,
        Long customerId,
        String customerName,
        CaseStatus status,
        Integer riskScoreAtCreation,
        String explanation,
        CaseDecision decision,
        String decisionNote,
        Long relatedDocumentId,
        Instant createdAt,
        Instant updatedAt) {

    public static CaseResponse from(CaseEntity c) {
        return new CaseResponse(
                c.getId(),
                c.getCustomer().getId(),
                c.getCustomer().getName(),
                c.getStatus(),
                c.getRiskScoreAtCreation(),
                c.getExplanation(),
                c.getDecision(),
                c.getDecisionNote(),
                c.getRelatedDocument() != null ? c.getRelatedDocument().getId() : null,
                c.getCreatedAt(),
                c.getUpdatedAt());
    }
}
