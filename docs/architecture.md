# Architecture

Product context: [product-vision.md](product-vision.md) · roadmap: [scope-and-timeline.md](scope-and-timeline.md).

## High-level

```
┌──────────────────────────────┐     ┌─────────────────────────────────────┐
│  Bank app / branch / core    │     │  React Staff SPA                      │
│  (customer never logs here)  │     │  Case queue · 360° · Analytics        │
└──────────────┬───────────────┘     └──────────────────┬──────────────────┘
               │ service credential                     │ staff JWT
               │ (P1)                                   │
┌──────────────▼────────────────────────────────────────▼──────────────────┐
│                    SPRING BOOT — product API / system of record            │
│  Auth │ Customer/KYC │ Document │ Transaction │ Risk │ Cases │ Admin       │
│  Audit │ Integration │ Webhooks (P1) │ Async jobs / optional RabbitMQ      │
└───────┬─────────────────────────────────┬────────────────────────────────┘
        │                                 │
┌───────▼────────────────┐    ┌───────────▼──────────────┐
│  Python CV/ML (:8001)  │    │  Python TX ML (:8002)    │
│  OCR, signature,       │    │  Rules + XGBoost/GBM     │
│  tamper, face match,   │    │  + SHAP explanations     │
│  liveness anti-spoof   │    │  (PaySim train/eval)     │
└────────────────────────┘    └──────────────────────────┘
        │
┌───────▼──────────┐   ┌─────────────────┐
│  PostgreSQL      │   │  Object storage │
│  (authoritative) │   │  (images/video) │
└──────────────────┘   └─────────────────┘
```

## Design principles

1. **Spring owns the bank product surface** — auth, RBAC, persistence, audit, cases, risk composition, OpenAPI, webhooks.
2. **Python owns inference only** — never the public product API.
3. **Dual channel** — staff ops desk + bank system integration; consumers stay on the bank’s UX.
4. **Async ML** — accept → `PENDING` → process → push (WebSocket) and/or webhook (NFR-2).
5. **Fail-closed KYC** — low quality, failed liveness, or spoof signals → `FLAGGED` / remain `PENDING`; never silent `VERIFIED`.
6. **Explainability** — weighted score **and** human-readable explanation.
7. **Immutable audit** — decisions and settings changes append-only (NFR-4).
8. **Sensitive data** — ID numbers encrypted at rest; images in object storage by reference.

## Liveness (anti-spoof)

Not a single still frame. Product path:

1. Issue a **liveness challenge** (e.g. turn head / speak code / short guided clip).
2. Client submits challenge response (frames or short video) with challenge id.
3. CV service returns `livenessScore`, spoof indicators, and quality flags.
4. Risk/KYC policy applies thresholds; fail-closed on ambiguity.

## Module map (backend)

| Package | FR coverage | Notes |
|---------|-------------|--------|
| `auth` | FR-1–4, FR-27 | Staff JWT; service credentials in P1 |
| `customer` | FR-5–8, FR-28 | KYC orchestration; bank external refs |
| `document` | FR-9–12 | Cheque/invoice fraud pipeline |
| `transaction` | FR-13–16 | Import + score persistence |
| `risk` | FR-17–20 | Weighted score + explanation + thresholds |
| `casemanagement` | FR-21–25 | Queue, decisions, WS broadcast |
| `audit` | FR-24, NFR-4 | Append-only |
| `admin` | FR-19, FR-26 | Weights + analytics |
| `websocket` | FR-25 | `/topic/cases` |
| `integration` | — | WebClient to Python; webhooks outbound P1 |
| `common` | NFR-3, NFR-5–6 | Errors, OpenAPI, encryption helpers |

## Async pipeline

```
Upload / bank submit → validate → store media → persist entity PENDING
  → async job → CV or TX ML
  → store scores → RiskEngine.recalculate → maybe Case
  → STOMP /topic/cases (+ webhook to bank, P1)
```

## Container topology (target)

| Service | Port | Context |
|---------|------|---------|
| `frontend` | 5173/80 | `frontend/` |
| `backend` | 8080 | `backend/` |
| `cv-ml` | 8001 | `services/cv-ml/` |
| `transaction-ml` | 8002 | `services/transaction-ml/` |
| `postgres` | 5432 | official |
| object storage | — | MinIO/S3-compatible (P1; local volume acceptable in early P0) |
| `rabbitmq` | 5672 / 15672 | optional profile `async` |

## Security sketch

- Staff: Spring Security + JWT (access + refresh), roles `ADMIN` · `COMPLIANCE` · `ANALYST`
- Bank systems (P1): service API keys or client-credentials JWT; scoped to integration routes
- Encrypt sensitive fields at rest; TLS in transit in deployed environments
- Secrets via env / secret manager; never logged
- Upload validation before ML; rate limits (P2)
