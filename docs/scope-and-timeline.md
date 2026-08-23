# Scope & roadmap — bank-ready product

North star: a **complete compliance product banks can pilot**, not a simplified demo. See [product-vision.md](product-vision.md).

## Must ship for bank pilot (P0–P1)

- Auth + RBAC (Admin / Compliance / Analyst) + refresh tokens
- Encryption at rest for sensitive identity fields; secrets from env; no secrets in logs
- Upload validation (type/size) before any ML call
- KYC with OCR, face match, and **anti-spoof liveness** (challenge / short video — not a single-frame heuristic)
- Document fraud (OCR + signature verification + tampering)
- Transaction monitoring: **real-time per-TX score API** on the bank payment path (bulk import only for backfill)
- Document fraud with **signature specimen enrollment**; tampering/OCR without pretending match when no reference exists
- Explainable weighted risk score (0–100) + auto case creation
- Case queue, decisions with mandatory notes, immutable audit
- Staff compliance dashboard + live WebSocket case updates
- Bank integration surface: service credentials, status APIs, webhooks (P1)
- Object storage for images; OpenAPI for every product endpoint; health/ops basics

## Phase roadmap

### P0 — Pilot core

Auth, schema, KYC + liveness challenge, documents, risk engine, cases, audit, staff UI, Spring ↔ Python integration, async jobs, fail-closed KYC.

### P1 — Bank integration

Service accounts / API keys for bank backends, webhooks on KYC/case complete, object storage, retention / subject-erase APIs, external reference IDs for bank core linkage.

### P2 — Hardening

HA deploy, monitoring/alerting, rate limits, SSO (OIDC) for staff, backup/DR runbooks, hardened secrets management.

### P3 — Scale / multi-bank

Tenancy and per-institution config isolation (multi-bank SaaS).

## Certification

Build an **evidence pack** (metrics, audit samples, threat notes, retention policy) that supports a future regulatory assessment. Do **not** claim “certified KYC” in product copy until an external process completes.

## Academic delivery track (FYP)

Thesis demos map onto **P0–P1** without lowering the product bar:

| Weeks | Focus | Phase |
|-------|--------|-------|
| 1–2 | Spring skeleton: auth, entities, schema, Swagger | P0 |
| 3–4 | CV: OCR + signature (CEDAR) | P0 |
| 5 | Spring ↔ Python async integration | P0 |
| 6 | Document fraud end-to-end | P0 |
| 7 | KYC + liveness challenge/anti-spoof | P0 |
| 8 | Transaction monitoring (rules + ML) | P0 |
| 9 | Risk engine + auto cases | P0 |
| 10 | React: case queue, 360°, WebSocket | P0 |
| 11 | Analytics, audit viewer, bank API/webhooks | P0–P1 |
| 12 | Metrics, hardening pass, demo, report | P1 evidence |

## Datasets (development & eval)

| Need | Source |
|------|--------|
| Signatures | CEDAR Signature Database |
| Transactions | PaySim (training/eval); bank-shaped CSV for integration tests |
| IDs / cheques | Synthetic templates (no real PII in public repos) |
| Invoices | SROIE or synthetic mocks |
| Liveness | Controlled spoof/live sets for anti-spoof eval |

Place downloads under `datasets/` (gitignored); commit READMEs only.

## Explicitly deferred (not abandoned)

| Item | When |
|------|------|
| Multi-tenant SaaS | P3 |
| Real-time payment authorization in the card/rail path | Outside Sentinel (core banking) |
| Formal regulatory certificate | External process after evidence pack |
