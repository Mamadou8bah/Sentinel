# Spring Boot API contracts (representative)

Public **product** API (staff ops desk + bank integration). springdoc-openapi. Authenticated unless noted.

Channels:

- **Staff** — JWT (`ADMIN` / `COMPLIANCE` / `ANALYST`).
- **Bank system** — service credential on `/api/integration/**`; retail clients never hold Sentinel passwords.

## Auth (staff)

| Method | Path | Roles | Purpose |
|--------|------|-------|---------|
| POST | `/api/auth/login` | public | Access + refresh tokens |
| POST | `/api/auth/refresh` | public (refresh) | Rotate access token |

## Bank integration

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/integration/kyc/sessions` | service | Start KYC (`tenant`, `externalCustomerId`); liveness challenge |
| POST | `/api/integration/kyc/sessions/{id}/submit` | service | ID + liveness media |
| GET | `/api/integration/kyc/sessions/{id}` | service | Poll KYC status |
| POST | `/api/integration/customers/{id}/signature-specimen` | service | Enroll / replace reference signature |
| POST | `/api/integration/documents` | service | Submit cheque/invoice for verify |
| POST | `/api/integration/transactions/score` | service | **Real-time** score one TX; bank uses response to allow/review/block |
| POST | `/api/integration/transactions/import` | service | Bulk backfill (secondary) |
| POST | `/api/webhooks/test` | ADMIN | Verify outbound webhook |

### Real-time transaction score (request / response shape)

**Request**

```json
{
  "externalCustomerId": "bank-core-123",
  "externalTransactionId": "tx-987",
  "amount": 1200.50,
  "currency": "GMD",
  "timestamp": "2024-01-15T12:00:00Z",
  "channel": "MOBILE",
  "location": "BJL",
  "counterparty": "optional"
}
```

**Response**

```json
{
  "externalTransactionId": "tx-987",
  "anomalyScore": 0.82,
  "flagged": true,
  "ruleFlags": ["AMOUNT_OUTLIER", "VELOCITY"],
  "recommendation": "REVIEW",
  "customerRiskScore": 74,
  "explanation": "Amount 4.2× customer 30-day average; elevated velocity",
  "shapTopFeatures": [
    { "feature": "amount_vs_avg_30d", "contribution": 0.31 },
    { "feature": "tx_count_24h", "contribution": 0.12 }
  ],
  "transactionId": "42"
}
```

`recommendation`: `ALLOW` | `REVIEW` | `BLOCK` (policy from tenant risk settings).  
`shapTopFeatures`: top SHAP contributions from the TX-ML service (why the model moved).

### Webhook (KYC / case / high-risk TX)

```json
{
  "event": "TX_FLAGGED",
  "externalCustomerId": "bank-core-123",
  "externalTransactionId": "tx-987",
  "customerId": "42",
  "riskScore": 74,
  "caseId": "9",
  "explanation": "…"
}
```

## Staff ops desk

| Method | Path | Roles | Purpose |
|--------|------|-------|---------|
| POST | `/api/customers` | ANALYST, COMPLIANCE, ADMIN | Start KYC (desk path) |
| POST | `/api/customers/{id}/signature-specimen` | ANALYST, COMPLIANCE, ADMIN | Enroll specimen |
| GET | `/api/customers/{id}` | *authenticated* | Customer 360° |
| GET | `/api/customers/{id}/risk-score` | *authenticated* | Score + explanation |
| POST | `/api/documents` | ANALYST, COMPLIANCE, ADMIN | Upload document to verify |
| GET | `/api/documents/{id}` | *authenticated* | Document + sub-scores |
| POST | `/api/transactions/score` | ANALYST, ADMIN | Desk/manual score (same engine) |
| POST | `/api/transactions/import` | ANALYST, ADMIN | Bulk backfill |
| GET | `/api/customers/{id}/transactions` | *authenticated* | History + flags |
| GET | `/api/cases` | COMPLIANCE, ANALYST, ADMIN | Case queue |
| PATCH | `/api/cases/{id}/decision` | COMPLIANCE, ADMIN | Decision + mandatory note |
| GET/PUT | `/api/admin/settings/risk-weights` | ADMIN | Tenant weights/thresholds |
| GET | `/api/admin/analytics/fraud-trend` | ADMIN | Analytics |

## Real-time (staff UI)

| Protocol | Path | Purpose |
|----------|------|---------|
| WebSocket STOMP | `/ws`; `/topic/cases` | New/flagged cases |

## Async vs sync

| Path | Semantics |
|------|-----------|
| Auth, TX **score**, status polls | Sync; TX score aimed for payment-path latency |
| KYC CV, document CV | Accept → PENDING → WebSocket/webhook when complete (NFR-2) |

## OpenAPI

springdoc (`/swagger-ui.html`). ML stubs: `docs/contracts/`.
