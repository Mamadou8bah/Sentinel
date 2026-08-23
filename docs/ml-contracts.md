# Python ML microservice contracts

Internal APIs called by Spring Boot via WebClient. Not public. Product bar: [product-vision.md](product-vision.md).

## CV/ML service (`services/cv-ml`) — default port 8001

### Liveness challenge

#### `POST /cv/liveness/challenge`

**Out**

```json
{
  "challengeId": "uuid",
  "instructions": ["TURN_LEFT", "TURN_RIGHT"],
  "expiresAt": "2024-01-15T12:05:00Z"
}
```

#### `POST /cv/liveness/verify`

**In**

```json
{
  "challengeId": "uuid",
  "videoOrFrames": "<base64-or-multipart-ref>"
}
```

**Out**

```json
{
  "livenessScore": 0.0,
  "spoofLikely": false,
  "qualityOk": true,
  "signals": ["MOTION_OK", "TEXTURE_OK"]
}
```

### `POST /cv/kyc-verify`

May be preceded by a successful liveness verify; Spring enforces fail-closed policy.

**In**

```json
{
  "idImage": "<base64>",
  "selfieImage": "<base64>",
  "challengeId": "uuid"
}
```

**Out**

```json
{
  "extractedFields": {
    "name": "string",
    "dob": "YYYY-MM-DD",
    "idNumber": "string",
    "expiry": "YYYY-MM-DD"
  },
  "faceMatchScore": 0.0,
  "livenessScore": 0.0,
  "tamperingScore": 0.0,
  "spoofLikely": false,
  "qualityOk": true
}
```

Scores are 0–1. Spring maps thresholds and creates/flags customers (FR-6–8). Ambiguous quality or `spoofLikely` must not auto-VERIFY (NFR-8).

### `POST /cv/document-verify`

Signature **match** requires a reference specimen. Tampering + OCR do not.

**In**

```json
{
  "documentImage": "<base64>",
  "referenceSignature": "<base64-or-null>",
  "docType": "CHEQUE | INVOICE",
  "knownFields": {
    "customerName": "optional",
    "accountNumber": "optional"
  }
}
```

**Out**

```json
{
  "extractedFields": {
    "amount": "string",
    "date": "string",
    "payee": "string",
    "accountNumber": "string"
  },
  "signatureMatchStatus": "SCORED | SKIPPED_NO_REFERENCE",
  "signatureMatchScore": 0.0,
  "tamperingScore": 0.0,
  "fieldConsistencyFlags": ["PAYEE_NAME_MISMATCH"]
}
```

If `referenceSignature` is null/absent → `signatureMatchStatus = SKIPPED_NO_REFERENCE` and `signatureMatchScore` is null. Spring applies fail-closed policy for high-value instruments without a specimen (FR-9–12).

---

## Transaction ML service (`services/transaction-ml`) — default port 8002

Called **per payment** (primary) or in small batches (backfill). Spring’s real-time bank API is one TX in → one score out.

**Stack:** deterministic rules + gradient-boosted / anomaly model (XGBoost or LightGBM and/or Isolation Forest on PaySim) + **SHAP** per-transaction feature attributions for compliance explainability.

### `POST /ml/transaction-score`

**In**

```json
{
  "transactions": [
    {
      "transactionId": "tx-987",
      "amount": 1200.5,
      "timestamp": "2024-01-15T12:00:00Z",
      "location": "BJL",
      "channel": "MOBILE",
      "customerFeatures": {
        "avgAmount30d": 280.0,
        "txCount24h": 6
      }
    }
  ]
}
```

**Out**

```json
{
  "scores": [
    {
      "transactionId": "tx-987",
      "anomalyScore": 0.82,
      "flagged": true,
      "ruleFlags": ["AMOUNT_OUTLIER", "HIGH_FREQUENCY"],
      "modelScore": 0.79,
      "explanation": "Amount far above customer baseline; elevated 24h velocity",
      "shapTopFeatures": [
        { "feature": "amount_vs_avg_30d", "contribution": 0.31 },
        { "feature": "tx_count_24h", "contribution": 0.12 },
        { "feature": "hour_of_day", "contribution": 0.08 }
      ]
    }
  ]
}
```

`shapTopFeatures` are the highest-magnitude SHAP values for that prediction (signed contributions). Spring maps them into case explanations and the bank score API response (FR-13–16).

---

## Health (both services)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health for compose / Spring readiness |

## Integration notes

- KYC/document CV: often `@Async`. **TX score:** sync on the bank payment path (tight timeout).
- Never send JWT secrets, API keys, or password hashes to Python.
- Prefer object-storage refs over huge inline base64 in production.
