package com.sentinel.customer.dto;

import com.sentinel.customer.model.KycSession;
import com.sentinel.customer.model.KycSessionStatus;
import com.sentinel.customer.model.KycStatus;
import java.time.Instant;

public record KycSessionResponse(
        Long sessionId,
        KycSessionStatus status,
        String externalCustomerId,
        String challengeId,
        String livenessHint,
        String explanation,
        Long customerId,
        KycStatus kycStatus,
        Integer riskScore,
        Double faceMatchScore,
        Double livenessScore,
        String publicToken,
        String hostedUrl,
        Instant expiresAt,
        String returnUrl) {

    public static KycSessionResponse from(KycSession session, String hostedUrl) {
        return new KycSessionResponse(
                session.getId(),
                session.getStatus(),
                session.getExternalCustomerId(),
                session.getChallengeId(),
                session.getLivenessHint(),
                session.getExplanation(),
                session.getCustomer() != null ? session.getCustomer().getId() : null,
                session.getCustomer() != null ? session.getCustomer().getKycStatus() : null,
                session.getCustomer() != null ? session.getCustomer().getRiskScore() : null,
                session.getCustomer() != null ? session.getCustomer().getFaceMatchScore() : null,
                session.getCustomer() != null ? session.getCustomer().getLivenessScore() : null,
                session.getPublicToken(),
                hostedUrl,
                session.getExpiresAt(),
                session.getReturnUrl());
    }
}
