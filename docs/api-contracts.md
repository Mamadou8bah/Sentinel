# Spring Boot API contracts (representative)

Public product API — implement with springdoc-openapi. All mutating ops under JWT unless noted.

## Auth

| Method | Path | Roles | Purpose |
|--------|------|-------|---------|
| POST | `/api/auth/login` | public | Issue access + refresh tokens |
| POST | `/api/auth/refresh` | public (refresh) | Rotate access token |

## Customers / KYC

| Method | Path | Roles | Purpose |
|--------|------|-------|---------|
| POST | `/api/customers` | ANALYST, COMPLIANCE, ADMIN | Create customer + trigger KYC pipeline (multipart ID + selfie) |
| GET | `/api/customers/{id}` | *authenticated* | Customer 360° view |
| GET | `/api/customers/{id}/risk-score` | *authenticated* | Current score + explanation |

## Documents

| Method | Path | Roles | Purpose |
|--------|------|-------|---------|
| POST | `/api/documents` | ANALYST, COMPLIANCE, ADMIN | Upload cheque/invoice (multipart), link to customer |
| GET | `/api/documents/{id}` | *authenticated* | Document + fraud sub-scores |

## Transactions

| Method | Path | Roles | Purpose |
|--------|------|-------|---------|
| POST | `/api/transactions/import` | ANALYST, ADMIN | Bulk CSV import (e.g. PaySim slice) |
| GET | `/api/customers/{id}/transactions` | *authenticated* | List + anomaly flags |

## Cases

| Method | Path | Roles | Purpose |
|--------|------|-------|---------|
| GET | `/api/cases` | COMPLIANCE, ANALYST, ADMIN | Queue; filter/sort by score, date, type, status |
| PATCH | `/api/cases/{id}/decision` | COMPLIANCE, ADMIN | approve / reject / escalate + **mandatory note** |

## Admin

| Method | Path | Roles | Purpose |
|--------|------|-------|---------|
| GET | `/api/admin/analytics/fraud-trend` | ADMIN | Trend + tier charts inputs |
| GET | `/api/admin/settings/risk-weights` | ADMIN | Current weights/thresholds |
| PUT | `/api/admin/settings/risk-weights` | ADMIN | Update config (triggers note in audit) |

## Real-time

| Protocol | Path | Purpose |
|----------|------|---------|
| WebSocket STOMP | `/ws` endpoint; topic `/topic/cases` | New flagged case notifications |

Suggested message payload (later):

```json
{
  "caseId": "...",
  "customerId": "...",
  "riskScore": 78,
  "type": "DOCUMENT_FRAUD",
  "explanation": "Signature match 61% (below 85% threshold); ..."
}
```

## Async semantics

- Sync CRUD/auth: target &lt; 300ms (NFR-1).
- Document/KYC/TX ML: accept upload → `202` or entity with `status=PENDING` → WebSocket/callback when complete (NFR-2).

## OpenAPI

Publish every Spring endpoint via springdoc-openapi (`/swagger-ui.html`).YAML stubs for ML live under `docs/contracts/`.
