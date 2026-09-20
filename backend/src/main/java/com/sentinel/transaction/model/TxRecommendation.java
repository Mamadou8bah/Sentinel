package com.sentinel.transaction.model;

/** Real-time TX score recommendation returned to the bank. */
public enum TxRecommendation {
    ALLOW,
    REVIEW,
    BLOCK
}
