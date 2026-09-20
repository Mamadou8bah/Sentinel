package com.sentinel.transaction.dto;

import com.sentinel.transaction.model.TransactionEntity;
import java.math.BigDecimal;
import java.time.Instant;

public record TxHistoryItemResponse(
        Long id,
        String externalTransactionId,
        BigDecimal amount,
        String currency,
        Instant occurredAt,
        String channel,
        Double anomalyScore,
        boolean flagged,
        String recommendation) {

    public static TxHistoryItemResponse from(TransactionEntity tx) {
        return new TxHistoryItemResponse(
                tx.getId(),
                tx.getExternalTransactionId() == null ? "" : tx.getExternalTransactionId(),
                tx.getAmount(),
                tx.getCurrency(),
                tx.getOccurredAt(),
                tx.getChannel() == null ? "" : tx.getChannel(),
                tx.getAnomalyScore() == null ? 0.0 : tx.getAnomalyScore(),
                tx.isFlagged(),
                tx.getRecommendation() == null ? "" : tx.getRecommendation().name());
    }
}
