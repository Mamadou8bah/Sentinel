# Spring Boot API contracts

Public **product** API (staff ops desk + bank integration). springdoc-openapi at `/swagger-ui.html`.

Channels:

- **Staff** — JWT (`ADMIN` / `COMPLIANCE` / `ANALYST`).
- **Bank system** — `X-Api-Key` on `/api/integration/**`; retail clients never hold Sentinel passwords.
- **Hosted KYC** — public `/api/kyc/hosted/{token}` for bank-redirected customers (no account).
- **Tenant self-serve** — `POST /api/tenants/register` is public; returns a **one-time** API key.

Demo tenant `demo-bank`: staff password `ChangeMe123!`; demo key `sen_demo_bank_local_dev_key_do_not_use_prod`.

## Auth (staff)

| Method | Path | Roles | Purpose |
|--------|------|-------|---------|
| POST | `/api/auth/login` | public | Access + refresh tokens (`tenantCode`, `username`, `password`) |
| POST | `/api/auth/refresh` | public (refresh) | Rotate access token |
| GET | `/api/me` | authenticated staff | Current user + tenant |

## Tenants

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/tenants/register` | public | Create bank tenant, admin user, risk settings, API key |

**Register request**

```json
{
  "code": "acme-bank",
  "name": "Acme Bank",
  "adminUsername": "admin",
  "adminPassword": "ChangeMe123!"
}
```

**Register response** — store `apiKey` immediately; it is not retrievable later.

## Bank integration (`X-Api-Key`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/integration/kyc/sessions` | Start KYC (`externalCustomerId`, optional `returnUrl`); returns challenge + `hostedUrl` |
| POST | `/api/integration/kyc/sessions/{id}/submit` | Bank-side ID + selfie submit (API key) |
| GET | `/api/integration/kyc/sessions/{id}` | Poll KYC session |
| GET | `/api/kyc/hosted/{token}` | **Public** hosted session view (no auth) |
| POST | `/api/kyc/hosted/{token}/submit` | **Public** hosted capture submit (no auth) |
| POST | `/api/integration/customers/{externalCustomerId}/signature-specimen` | Enroll specimen |
| POST | `/api/integration/documents` | Cheque/invoice verify |
| POST | `/api/integration/transactions/score` | Real-time score one TX |
| POST | `/api/integration/transactions/import` | Bulk CSV backfill |
| POST | `/api/integration/kyc/sessions/{id}/submit-multipart` | KYC submit via multipart |
| POST | `/api/integration/documents/multipart` | Document verify via multipart |

### Staff login

```json
{ "tenantCode": "demo-bank", "username": "admin", "password": "ChangeMe123!" }
```

Response includes `accessToken`, `refreshToken`, `role`, `tenantCode`, `tenantId`.

### Start KYC (bank)

```json
{
  "externalCustomerId": "bank-core-123",
  "returnUrl": "https://bank.example/onboarding/continue"
}
```

Response includes `sessionId`, `challengeId`, `livenessHint`, `publicToken`, `hostedUrl`, `expiresAt`.  
Bank redirects the customer to `hostedUrl` (Sentinel hosted KYC UI).

### Hosted KYC (customer — public token)

`GET /api/kyc/hosted/{token}` → tenant display name, challenge hint, status, expiry.  
`POST /api/kyc/hosted/{token}/submit`:

```json
{
  "idImage": "<base64>",
  "selfieImage": "<base64>",
  "name": "optional"
}
```

Challenge is bound server-side to the session (customer does not hold the bank API key).

### KYC submit (bank API key path)

```json
{
  "challengeId": "chal_…",
  "idImage": "<base64>",
  "selfieImage": "<base64>",
  "name": "optional"
}
```

`challengeId` must match the value returned from session start (liveness challenge).

### Document verify

```json
{
  "externalCustomerId": "bank-core-123",
  "docType": "CHEQUE",
  "documentImage": "<base64>"
}
```

`signatureMatchStatus` is `SCORED` or `SKIPPED_NO_REFERENCE` (no fake score without a specimen).

### Real-time transaction score

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
  "ruleFlags": ["AMOUNT_OUTLIER"],
  "recommendation": "REVIEW",
  "customerRiskScore": 74,
  "explanation": "Triggered: AMOUNT_OUTLIER",
  "shapTopFeatures": [
    { "feature": "amount_vs_avg_30d", "contribution": 0.31 },
    { "feature": "tx_count_24h", "contribution": 0.12 }
  ],
  "transactionId": "42",
  "caseId": "9"
}
```

`recommendation`: `ALLOW` | `REVIEW` | `BLOCK` from tenant risk settings.  
Idempotent on `(tenant, externalTransactionId)`.

ML: with `sentinel.ml.stub=true` (default), Spring returns deterministic stub scores. Point `CV_ML_BASE_URL` / `TRANSACTION_ML_BASE_URL` and set stub false when Python services are ready.

## Staff ops desk (JWT)

| Method | Path | Roles | Purpose |
|--------|------|-------|---------|
| GET | `/api/customers` | ANALYST, COMPLIANCE, ADMIN | List customers |
| GET | `/api/customers/{id}` | *authenticated staff* | Customer 360° |
| GET | `/api/customers/{id}/risk-score` | *authenticated staff* | Score snapshot |
| GET | `/api/customers/{id}/documents` | ANALYST, COMPLIANCE, ADMIN | Documents for 360° |
| POST | `/api/customers/{id}/signature-specimen` | ANALYST, COMPLIANCE, ADMIN | Enroll specimen |
| POST | `/api/documents` | ANALYST, COMPLIANCE, ADMIN | Verify document |
| GET | `/api/documents/{id}` | *authenticated staff* | Document + sub-scores |
| POST | `/api/transactions/score` | ANALYST, ADMIN | Desk score (same engine) |
| POST | `/api/transactions/import` | ANALYST, ADMIN | Bulk CSV backfill |
| GET | `/api/customers/{id}/transactions` | *authenticated staff* | History + flags |
| GET | `/api/cases` | COMPLIANCE, ANALYST, ADMIN | Case queue (`?status=&sort=risk|date`) |
| GET | `/api/cases/{id}` | COMPLIANCE, ANALYST, ADMIN | Case detail |
| PATCH | `/api/cases/{id}/decision` | COMPLIANCE, ADMIN | Decision + mandatory note |
| GET | `/api/audit` | ADMIN, COMPLIANCE | Audit trail |
| GET/PUT | `/api/admin/settings/risk-weights` | ADMIN | Tenant weights/thresholds |
| GET/PUT | `/api/admin/settings/webhook` | ADMIN | Outbound webhook URL |
| POST | `/api/admin/webhooks/test` | ADMIN | Fire test webhook |
| GET | `/api/admin/analytics/fraud-trend` | ADMIN | Analytics counts |

### Case decision

```json
{ "decision": "APPROVE", "note": "Verified with branch manager" }
```

## Real-time (staff UI)

| Protocol | Path | Purpose |
|----------|------|---------|
| WebSocket STOMP | `/ws`; subscribe `/topic/tenants.{tenantId}.cases` | Case open / decide push (JWT on CONNECT) |

## Remaining gaps

| Item | Notes |
|------|-------|
| Trained Python CV/TX models | `MlGateway` ready; services still stub/scaffold |
| Object storage (S3/MinIO) | Local `uploads/` today |

## OpenAPI

springdoc (`/swagger-ui.html`). ML stubs: `docs/contracts/`.
