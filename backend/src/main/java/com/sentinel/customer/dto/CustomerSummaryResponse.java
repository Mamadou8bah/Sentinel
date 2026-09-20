package com.sentinel.customer.dto;

import com.sentinel.customer.model.Customer;
import com.sentinel.customer.model.KycStatus;

public record CustomerSummaryResponse(
        Long id,
        String name,
        String externalCustomerId,
        KycStatus kycStatus,
        Integer riskScore,
        boolean hasSignatureSpecimen) {

    public static CustomerSummaryResponse from(Customer c) {
        return new CustomerSummaryResponse(
                c.getId(),
                c.getName(),
                c.getExternalCustomerId() == null ? "" : c.getExternalCustomerId(),
                c.getKycStatus(),
                c.getRiskScore(),
                c.getReferenceSignatureUrl() != null);
    }
}
