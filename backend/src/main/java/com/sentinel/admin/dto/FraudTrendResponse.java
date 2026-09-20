package com.sentinel.admin.dto;

import java.util.Map;

public record FraudTrendResponse(
        long customers,
        long documents,
        long transactions,
        long flaggedTransactions,
        long casesTotal,
        long casesOpen,
        long casesUnderReview,
        long casesResolved,
        Map<String, Long> customersByKycStatus) {}
