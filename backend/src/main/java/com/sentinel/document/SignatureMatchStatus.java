package com.sentinel.document;

/** Signature match requires an enrolled specimen; otherwise SKIPPED_NO_REFERENCE. */
public enum SignatureMatchStatus {
    PENDING,
    SCORED,
    SKIPPED_NO_REFERENCE
}
