package com.sentinel.transaction.dto;

import com.sentinel.transaction.model.TransactionEntity;
import com.sentinel.transaction.model.TxRecommendation;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public record TxScoreResponse(
        String externalTransactionId,
        String transactionId,
        Double anomalyScore,
        boolean flagged,
        List<String> ruleFlags,
        TxRecommendation recommendation,
        Integer customerRiskScore,
        String explanation,
        List<Map<String, Object>> shapTopFeatures,
        String externalCustomerId,
        String caseId) {

    public static TxScoreResponse from(
            TransactionEntity tx, Integer customerRiskScore, String externalCustomerId, String caseId) {
        return new TxScoreResponse(
                tx.getExternalTransactionId(),
                tx.getId().toString(),
                tx.getAnomalyScore(),
                tx.isFlagged(),
                tx.getRuleFlags() == null ? List.of() : tx.getRuleFlags(),
                tx.getRecommendation(),
                customerRiskScore,
                tx.getExplanation(),
                tx.getShapTopFeatures() == null ? List.of() : tx.getShapTopFeatures(),
                externalCustomerId,
                caseId);
    }
}
