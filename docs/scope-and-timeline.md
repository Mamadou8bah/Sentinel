# Scope & 12-week timeline

## Must build (core, fully functional)

- Auth + role-based access (Admin / Compliance / Analyst)
- Document Fraud module (signature verification + OCR + tampering) — primary CV showcase
- Risk Scoring Engine (weighted + explainable string)
- Case Management Dashboard with real-time WebSocket updates
- Immutable Audit Log

## Build simplified

| Area | Approach |
|------|----------|
| KYC | OCR + basic face match; liveness as simplified single-frame heuristic |
| Transaction monitoring | Rule-based flags + one Isolation Forest on PaySim — not deep learning |

## Explicitly out of scope (state in report)

- Real regulatory certification / production PII handling
- Multi-bank / multi-tenant support
- Real payment processing integration

## Success criteria (FYP)

1. End-to-end demo: upload → analysis → risk score → dashboard decision (real time)
2. Measurable model metrics (signature P/R, OCR accuracy, TX false positive rate)
3. Clean architecture + audit trail — production-grade thinking, not a notebook alone

## Suggested timeline (12 weeks)

| Weeks | Focus |
|-------|--------|
| 1–2 | Spring Boot skeleton: auth, entities, DB schema, Swagger |
| 3–4 | Python CV: OCR + signature model trained on CEDAR |
| 5 | Integrate Spring ↔ Python (sync call + async wrapper) |
| 6 | Document Fraud module end-to-end |
| 7 | KYC module (simplified face + liveness) |
| 8 | Transaction monitoring (PaySim + Isolation Forest) |
| 9 | Risk Scoring Engine + case auto-creation |
| 10 | React: case queue, customer 360°, WebSocket live updates |
| 11 | Analytics, audit viewer, polish |
| 12 | Testing, metrics writeup, demo rehearsal, report |

## Dataset plan (free)

| Need | Source |
|------|--------|
| Signatures | CEDAR Signature Database |
| Transactions | PaySim |
| IDs / cheques | Self-generated synthetic templates (no real PII) |
| Invoices | SROIE or self-generated mocks |

Place downloaded files under `datasets/` (gitignored); keep only READMEs committed.
