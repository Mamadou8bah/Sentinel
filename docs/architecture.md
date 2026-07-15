# Architecture

## High-level

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend (SPA)                      │
│         Compliance Dashboard | Case Queue | Analytics         │
└───────────────────────────┬───────────────────────────────────┘
                            │ REST + WebSocket (STOMP)
┌───────────────────────────▼───────────────────────────────────┐
│                 SPRING BOOT API GATEWAY / CORE                │
│  Auth │ Customer │ Document │ Transaction │ Admin               │
│  Risk Scoring Engine (Java)                                   │
│  Async Job Orchestration (Spring @Async / optional RabbitMQ)  │
└───────┬───────────────────────────────────┬───────────────────┘
        │ REST (sync) or MQ (async)         │
┌───────▼────────────────┐    ┌─────────────▼──────────────┐
│  Python CV/ML Service  │    │  Python Transaction ML     │
│  (FastAPI :8001)       │    │  (FastAPI :8002)           │
│  OCR, signature,       │    │  Rules + IsolationForest   │
│  tampering, face/liveness│   │  (PaySim-trained)          │
└────────────────────────┘    └────────────────────────────┘
                            │
                ┌───────────▼───────────┐
                │   PostgreSQL (JPA)    │
                └───────────────────────┘
```

## Design principles

1. **Spring owns the bank system surface** — auth, RBAC, persistence, audit, cases, risk composition, OpenAPI.
2. **Python owns inference only** — called internally; never exposed as the public product API.
3. **CV/ML is async from the user POV** — API returns “processing”; results pushed over STOMP when ready (NFR-2).
4. **Explainability** — risk engine produces a weighted score **and** a human-readable explanation string.
5. **Immutable audit** — every compliance decision writes `AuditLog`; no update/delete API.

## Module map (backend)

| Package | FR coverage | Notes |
|---------|-------------|--------|
| `auth` | FR-1–4 | JWT + refresh, BCrypt, `@PreAuthorize` |
| `customer` | FR-5–8 | KYC pipeline orchestration |
| `document` | FR-9–12 | Cheque/invoice fraud pipeline |
| `transaction` | FR-13–16 | CSV import + score persistence |
| `risk` | FR-17–20 | Weighted score + explanation + thresholds |
| `casemanagement` | FR-21–25 | Queue, decisions, WS broadcast |
| `audit` | FR-24, NFR-4 | Append-only |
| `admin` | FR-19, FR-26 | Weights + analytics |
| `websocket` | FR-25 | `/ws/cases` STOMP topic |
| `integration` | — | WebClient to Python services |

## Async pipeline (deliberate)

```
Upload → Spring validates (type/size) → persist Document/Customer (PENDING)
      → @Async job → WebClient → Python inference
      → store scores → RiskEngine.recalculate → maybe auto-create Case
      → STOMP push to /topic/cases
```

Highlight in report/interviews: non-blocking API under load, clear ownership boundary.

## Container / process topology (target)

| Service | Port | Image build context |
|---------|------|---------------------|
| `frontend` | 5173/80 | `frontend/` |
| `backend` | 8080 | `backend/` |
| `cv-ml` | 8001 | `services/cv-ml/` |
| `transaction-ml` | 8002 | `services/transaction-ml/` |
| `postgres` | 5432 | official image |
| `rabbitmq` (optional) | 5672 / 15672 | profile `async` |

## Security sketch

- Spring Security + JWT (access + refresh)
- Role hierarchy: `ADMIN` · `COMPLIANCE` · `ANALYST`
- Sensitive fields (e.g. ID numbers) encrypted at rest
- Secrets via env; never logged
- Upload validation before any ML call
