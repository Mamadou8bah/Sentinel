package com.sentinel.customer.dto;

import com.sentinel.customer.model.Customer;
import com.sentinel.customer.model.KycStatus;

public record CustomerRiskScoreResponse(Long customerId, Integer riskScore, KycStatus kycStatus) {
    public static CustomerRiskScoreResponse from(Customer c) {
        return new CustomerRiskScoreResponse(c.getId(), c.getRiskScore(), c.getKycStatus());
    }
}
