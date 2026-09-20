# Architecture

Product context: [product-vision.md](product-vision.md) · API: [api-contracts.md](api-contracts.md) · data: [data-model.md](data-model.md).

## High-level

```
┌──────────────────────────────┐     ┌─────────────────────────────────────┐
│  Bank app / branch / core    │     │  React Staff SPA                      │
│  (customer never logs here)  │     │  Case queue · 360° · Analytics        │
└──────────────┬───────────────┘     └──────────────────┬──────────────────┘
               │ X-Api-Key                              │ staff JWT
┌──────────────▼────────────────────────────────────────▼──────────────────┐
│                    SPRING BOOT — product API / system of record            │
│  Tenant │ Auth │ Customer/KYC │ Document │ Transaction │ Risk │ Cases     │
│  Audit │ Admin │ Integration │ Async jobs / optional RabbitMQ (later)     │
└───────┬─────────────────────────────────┬────────────────────────────────┘
        │ stub or HTTP                    │ stub or HTTP
┌───────▼────────────────┐    ┌───────────▼──────────────┐
│  Python CV/ML (:8001)  │    │  Python TX ML (:8002)    │
│  OCR, signature,       │    │  Rules + XGBoost/GBM     │
│  tamper, face match,   │    │  + SHAP explanations     │
│  liveness anti-spoof   │    │  (PaySim train/eval)     │
└────────────────────────┘    └──────────────────────────┘
        │
┌───────▼──────────┐   ┌─────────────────┐
│  PostgreSQL      │   │  Local uploads/ │
│  (authoritative) │   │  (object store  │
└──────────────────┘   │   later)        │
                       └─────────────────┘
```

## Design principles

1. **Spring owns the bank product surface** — auth, RBAC, persistence, audit, cases, risk composition, OpenAPI.
2. **Python owns inference only** — never the public product API. Until ML is wired, Spring uses a deterministic **stub** (`sentinel.ml.stub=true`).
3. **Dual channel** — staff ops desk (JWT) + bank system integration (`X-Api-Key`); consumers stay on the bank’s UX.
4. **Multi-tenant isolation** — every domain row carries `tenant_id`; API keys and staff users are tenant-scoped.
5. **Fail-closed KYC** — weak face/liveness → `FLAGGED` / `REJECTED`; never silent `VERIFIED`.
6. **Honest signature match** — no specimen → `SKIPPED_NO_REFERENCE` (not a fake score).
7. **Explainability** — weighted score **and** human-readable explanation (+ SHAP fields on TX).
8. **Immutable audit** — decisions, settings, KYC, documents, TX scores append-only.

## Auth model

| Actor | How | Scope |
|-------|-----|--------|
| Staff | `POST /api/auth/login` → Bearer JWT | Tenant of the user |
| Bank system | `X-Api-Key` on `/api/integration/**` | Tenant of the key |
| New bank | `POST /api/tenants/register` (public) | Creates tenant, admin, risk settings, one-time API key |

## Module map (backend)

| Package | Status | Notes |
|---------|--------|--------|
| `tenant` | **Implemented** | Register + hashed API keys + filter |
| `auth` | **Implemented** | Staff JWT + refresh + seed |
| `customer` | **Implemented** | KYC sessions, specimen, 360° |
| `document` | **Implemented** | Verify + signature skip |
| `transaction` | **Implemented** | Real-time score + history |
| `risk` | **Implemented** | Engine + thresholds |
| `casemanagement` | **Implemented** | Open + decide + queue |
| `audit` | **Implemented** | `AuditService` writers |
| `admin` | **Implemented** | Risk weights GET/PUT |
| `integration` | **Implemented** | Bank controllers + stub ML |
| `websocket` | Scaffold | STOMP push next |
| `common` | **Implemented** | OpenAPI, `.env`, storage |

## Request flow (payment path)

```
Bank core ──X-Api-Key──▶ POST /api/integration/transactions/score
                              │
                              ├─ resolve customer by externalCustomerId
                              ├─ stub/ML anomaly + SHAP-shaped features
                              ├─ RiskEngine → ALLOW | REVIEW | BLOCK
                              ├─ persist Transaction (+ Case if flagged)
                              └─ AuditService TX_SCORE
```

## Container topology

| Service | Port | Context |
|---------|------|---------|
| `frontend` | 5173/80 | `frontend/` |
| `backend` | 8080 | `backend/` |
| `cv-ml` | 8001 | `services/cv-ml/` |
| `transaction-ml` | 8002 | `services/transaction-ml/` |
| `postgres` | 5432 | `docker-compose` |

## Security sketch

- Staff: Spring Security + JWT (access + refresh), roles `ADMIN` · `COMPLIANCE` · `ANALYST`
- Bank systems: SHA-256 hashed API keys; prefix lookup; never store raw key after issue
- Uploads stored under `uploads/{tenantId}/…` (gitignored)
- Secrets via env / `.env`; never return API keys after first issue
