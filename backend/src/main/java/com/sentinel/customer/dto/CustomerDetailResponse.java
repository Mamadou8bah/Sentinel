package com.sentinel.customer.dto;

import com.sentinel.customer.model.KycStatus;
import java.time.Instant;
import java.time.LocalDate;

public record CustomerDetailResponse(
        Long id,
        String name,
        String externalCustomerId,
        LocalDate dob,
        String idNumberMasked,
        KycStatus kycStatus,
        Double faceMatchScore,
        Double livenessScore,
        Integer riskScore,
        boolean hasSignatureSpecimen,
        int documentCount,
        int transactionCount,
        Instant createdAt) {}
