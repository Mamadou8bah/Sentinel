# Python ML microservice contracts

Internal APIs called by Spring Boot via WebClient. Not public.

## CV/ML service (`services/cv-ml`) — default port 8001

### `POST /cv/kyc-verify`

**In**

```json
{
  "idImage": "<base64>",
  "selfieImage": "<base64>"
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
  "tamperingScore": 0.0
}
```

Scores are 0–1. Spring maps thresholds and creates/flags customers (FR-6–8).

### `POST /cv/document-verify`

**In**

```json
{
  "documentImage": "<base64>",
  "referenceSignature": "<base64>",
  "docType": "CHEQUE | INVOICE"
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
  "signatureMatchScore": 0.0,
  "tamperingScore": 0.0
}
```

Used for FR-9–12 (CEDAR-trained Siamese CNN + ELA + OCR).

---

## Transaction ML service (`services/transaction-ml`) — default port 8002

### `POST /ml/transaction-score`

**In**

```json
{
  "transactions": [
    {
      "transactionId": "optional-client-id",
      "amount": 1200.5,
      "timestamp": "2024-01-15T12:00:00Z",
      "location": "string"
    }
  ]
}
```

**Out**

```json
{
  "scores": [
    {
      "transactionId": "optional-client-id",
      "anomalyScore": 0.0,
      "flagged": true,
      "ruleFlags": ["AMOUNT_OUTLIER", "HIGH_FREQUENCY"]
    }
  ]
}
```

Rules + Isolation Forest on PaySim (FR-13–16). Keep this service intentionally simpler than CV.

---

## Health (both services)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness for compose / Spring readiness |

## Integration notes

- Spring wraps calls in `@Async` (or RabbitMQ later).
- Timeouts and retries belong in `backend/.../integration`.
- Never send JWT secrets or password hashes to Python services.
- Prefer storing images in backend storage and sending base64 only for inference payload size limits (or multipart later).
