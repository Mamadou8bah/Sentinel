# Integration module

**Owns:** glue between Spring (system of record) and the outside world — Python ML **and** (P1) bank callbacks.  
**Requirements:** supports FR-6, FR-10, FR-14, FR-28.

## What this module is

```
Customer / Document / TX services
        ↓
  Integration (WebClient + webhook publisher)
        ↓
  CV_ML · TRANSACTION_ML · bank webhook URL
```

Domain modules should not hard-code HTTP details.

## Outbound ML (P0)

| Env base | Path | Used for |
|----------|------|----------|
| `CV_ML_BASE_URL` | `/cv/liveness/challenge`, `/cv/liveness/verify` | Anti-spoof challenge |
| `CV_ML_BASE_URL` | `/cv/kyc-verify` | ID + face + liveness context |
| `CV_ML_BASE_URL` | `/cv/document-verify` | Cheque/invoice fraud scores |
| `TRANSACTION_ML_BASE_URL` | `/ml/transaction-score` | Anomaly scores |

## Outbound bank webhooks (P1)

On KYC complete / case decision → POST signed payload to the bank’s configured URL (`externalCustomerId`, status, risk, case id). See `docs/api-contracts.md`.

## How ML calls work

1. Async job after upload/import.
2. Timeouts + retries; mark entity `FAILED` on exhaustion.
3. On success → scores → **risk** → maybe **case** → WebSocket (+ webhook).

## What’s here now

Scaffold. WebClient beans, DTOs, and webhook sender land with P0/P1 pipelines.
