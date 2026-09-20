package com.sentinel.customer.dto;

import com.sentinel.customer.model.KycSession;
import com.sentinel.customer.model.KycSessionStatus;
import com.sentinel.customer.model.KycStatus;
import java.time.Instant;

/** Public view for the hosted KYC page — no internal secrets. */
public record HostedKycSessionResponse(
        KycSessionStatus status,
        String tenantName,
        String tenantCode,
        String livenessHint,
        Instant expiresAt,
        boolean expired,
        String returnUrl,
        String explanation,
        KycStatus kycStatus,
        Integer riskScore) {

    public static HostedKycSessionResponse from(KycSession session, boolean expired) {
        return new HostedKycSessionResponse(
                session.getStatus(),
                session.getTenant().getName(),
                session.getTenant().getCode(),
                session.getLivenessHint(),
                session.getExpiresAt(),
                expired,
                session.getReturnUrl(),
                session.getExplanation(),
                session.getCustomer() != null ? session.getCustomer().getKycStatus() : null,
                session.getCustomer() != null ? session.getCustomer().getRiskScore() : null);
    }
}
