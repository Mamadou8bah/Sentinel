# Product Requirements Document

**Sentinel — AI-Powered KYC & Fraud Prevention Platform for Banks**

| Field | Value |
|-------|--------|
| **Version** | 2.0 |
| **Type** | Final Year Project — Computer Science |
| **Status** | Living product PRD (supersedes original v1.0 student scaffold) |
| **Target stack** | Java 17+ / Spring Boot 3 (core API) · Python FastAPI (CV/ML + TX ML) · PostgreSQL · React + TypeScript |
| **Related docs** | [product-vision.md](product-vision.md) · [architecture.md](architecture.md) · [api-contracts.md](api-contracts.md) · [data-model.md](data-model.md) · [functional-requirements.md](functional-requirements.md) · [nfr.md](nfr.md) · [scope-and-timeline.md](scope-and-timeline.md) · [demo-script.md](demo-script.md) · [evaluation-metrics.md](evaluation-metrics.md) |

---

## 1. Overview

### 1.1 Problem statement

Banks lose money and trust to:

1. **Identity fraud** during onboarding (fake IDs, synthetic identities, presentation attacks / spoofs)
2. **Document fraud** (forged cheques, tampered invoices, mismatched signatures)
3. **Suspicious payment behaviour** that batch tools catch too late

Compliance teams often juggle fragmented KYC, document, and transaction tools. Review is slow, inconsistent, and hard to **audit**. Retail customers already live in the **bank’s** app or branch — they should not be asked to “sign up for Sentinel.”

### 1.2 Product vision

Sentinel is a **multi-tenant bank compliance platform**: KYC, document fraud detection, **real-time transaction risk scoring**, explainable customer risk, case management, and an immutable audit trail.

Banks **integrate** Sentinel behind their own channels. Sentinel is the **engine + compliance ops desk**, not core banking and not a consumer fintech app.

> **v1 → v2 scope change:** The original PRD assumed a simulated “applicant uploads on Sentinel” flow and deferred multi-tenant / bank payment integration. The product now treats the **bank system** as a first-class actor (service API keys), **staff** as JWT roles, and **customers** as bank clients only — never Sentinel logins. Real-time per-payment scoring is the primary TX path; bulk CSV is backfill only.

### 1.3 Target users / actors

| Actor | Role | How they touch Sentinel |
|-------|------|-------------------------|
| **Compliance officer** | Reviews flagged cases; approve / reject / escalate with notes | Staff SPA + JWT (`COMPLIANCE`) |
| **Fraud analyst** | Investigates documents / transactions; uploads / desk scores | Staff SPA + JWT (`ANALYST`) |
| **Admin** | Risk weights/thresholds; analytics; tenant ops | Staff SPA + JWT (`ADMIN`) |
| **Bank system** | Onboarding, document capture, payment switch | Integration API + `X-Api-Key` |
| **Bank customer (retail)** | Applies / pays via **bank** app or branch | **Never** a Sentinel account |
| **Tenant (bank)** | Institution on the platform | Self-serve register → one-time API key |

### 1.4 Success criteria

#### For FYP evaluation

- End-to-end story: bank-shaped KYC → specimen → document check → **live TX score** → case → decision → audit
- Measurable ML metrics (signature, OCR, TX anomaly / SHAP-backed explanations where applicable)
- Clean, documented architecture that shows production-grade engineering (auth, tenancy, audit, dual channel) — not a notebook demo

#### For bank pilot readiness

- Multi-tenant data isolation; staff RBAC; hashed service credentials
- Fail-closed KYC; honest signature match (`SKIPPED_NO_REFERENCE` when no specimen)
- Per-TX `ALLOW` / `REVIEW` / `BLOCK` with explanations
- OpenAPI coverage; health endpoints; evidence pack for future certification (**not** claiming “certified KYC” in marketing)

---

## 2. System architecture

### 2.1 High-level architecture

```
┌──────────────────────────────┐     ┌─────────────────────────────────────┐
│  Bank app / branch / core    │     │  React Staff SPA                      │
│  (customer never logs here)  │     │  Case queue · 360° · Analytics        │
└──────────────┬───────────────┘     └──────────────────┬──────────────────┘
               │ X-Api-Key                              │ staff JWT
┌──────────────▼────────────────────────────────────────▼──────────────────┐
│                    SPRING BOOT — product API / system of record            │
│  Tenant │ Auth │ Customer/KYC │ Document │ Transaction │ Risk │ Cases     │
│  Audit │ Admin │ Integration │ (WebSocket / webhooks / async jobs)        │
└───────┬─────────────────────────────────┬────────────────────────────────┘
        │ stub or HTTP                    │ stub or HTTP
┌───────▼────────────────┐    ┌───────────▼──────────────┐
│  Python CV/ML (:8001)  │    │  Python TX ML (:8002)    │
│  OCR, signature,       │    │  Rules + GBM/XGBoost     │
│  tamper, face match,   │    │  + SHAP explanations     │
│  liveness anti-spoof   │    │  (PaySim train/eval)     │
└────────────────────────┘    └──────────────────────────┘
        │
┌───────▼──────────┐   ┌─────────────────┐
│  PostgreSQL      │   │  Media storage  │
│  (authoritative) │   │  (local → S3)   │
└──────────────────┘   └─────────────────┘
```

**Why this split:** Spring owns everything a bank integration must take seriously — auth, tenancy, workflow, persistence, audit, product APIs. Python owns **inference only**. That is a realistic polyglot pattern and keeps the “system of record” defensible in a viva or bank pilot conversation.

Detail: [architecture.md](architecture.md).

### 2.2 Tech stack

| Layer | Technology |
|-------|------------|
| Backend core | Java 17+, Spring Boot 3.x |
| Security | Spring Security + JWT (jjwt); BCrypt; SHA-256 hashed API keys |
| Persistence | Spring Data JPA + PostgreSQL (H2 for local/dev) |
| Async / messaging | Spring `@Async` first; optional RabbitMQ profile |
| Real-time (staff) | Spring WebSocket (STOMP) — planned for case push |
| CV/ML service | Python 3.11, FastAPI |
| OCR | Tesseract / EasyOCR / TrOCR (implementation choice) |
| Signature verification | Siamese CNN (PyTorch) on CEDAR |
| Tampering | Error Level Analysis + classifier |
| Face / liveness | Embeddings + **challenge-based** anti-spoof (not single-frame-only) |
| Transaction ML | Rules + XGBoost/LightGBM (+ optional IF); **SHAP** explanations |
| Frontend | React + TypeScript, Tailwind (marketing live; staff desk next) |
| API docs | springdoc-openapi (Swagger UI) |
| Containerization | Docker + docker-compose |
| Testing | JUnit 5, Mockito, Testcontainers (expand over time) |

### 2.3 Design principles (locked)

1. Customers register with the **bank**, not Sentinel  
2. Dual channel: staff desk + bank integration  
3. Multi-tenant isolation on every domain row  
4. Fail-closed KYC  
5. Signature match only with an enrolled specimen  
6. Real-time TX score is primary; bulk import is secondary  
7. Explainability (human text + SHAP-shaped features on TX)  
8. Immutable audit for decisions and material events  
9. Pilot-grade engineering; certification is external  

---

## 3. Functional requirements by module

Canonical index: [functional-requirements.md](functional-requirements.md). Summaries below reflect **v2 scope**.

### 3.1 Auth & user management (Spring Boot)

| ID | Requirement |
|----|-------------|
| **FR-1** | Role-based staff login (`ADMIN`, `COMPLIANCE`, `ANALYST`) via Spring Security + JWT |
| **FR-2** | Passwords hashed with BCrypt |
| **FR-3** | Role-based endpoint access (`@PreAuthorize`) |
| **FR-4** | Access token expiry + refresh token rotation |
| **FR-27** | Bank **service API keys** (hashed at rest) for `/api/integration/**` |
| — | Tenant self-serve: `POST /api/tenants/register` issues admin user + one-time API key |

### 3.2 Customer onboarding (KYC)

| ID | Requirement |
|----|-------------|
| **FR-5** | Capture ID image + selfie / **liveness challenge response** (via bank channel or staff desk) |
| **FR-6** | CV microservice: OCR fields, ID tampering, face match, anti-spoof liveness |
| **FR-7** | Persist Customer profile + scores (`externalCustomerId` for bank core linkage); encrypt sensitive fields at rest (target) |
| **FR-8** | Auto-create Case when KYC policy thresholds breached |
| **FR-28** | KYC **session** lifecycle (start / submit / poll) + outbound webhooks to bank (webhook P1) |
| **FR-30** | Fail-closed: spoof / poor quality / ambiguity → `FLAGGED` / `REJECTED` / stay `PENDING` — never silent `VERIFIED` |

**v2 change:** No public “applicant uploads on Sentinel” product path. Demo simulates the **bank** submitting media.

### 3.3 Document fraud detection

| ID | Requirement |
|----|-------------|
| **FR-9** | Enroll **reference signature specimen**; upload cheque/invoice linked to a Customer |
| **FR-10** | CV: tampering + OCR always; **signature match only if specimen exists** |
| **FR-11** | Persist Document + sub-scores; `signatureMatchStatus = SKIPPED_NO_REFERENCE` when no specimen |
| **FR-12** | Below-threshold / policy breach → auto Case |

### 3.4 Transaction monitoring

| ID | Requirement |
|----|-------------|
| **FR-13** | **Real-time** `POST …/transactions/score` for the bank payment path (`ALLOW` / `REVIEW` / `BLOCK`) |
| **FR-13b** | Bulk CSV / batch import for **backfill / training only** (not primary path) |
| **FR-14** | TX ML: rule flags + boosted/anomaly model + **SHAP** top features |
| **FR-15** | Persist Transaction with scores, flags, recommendation, explanation |
| **FR-16** | Feed TX risk into overall customer risk |

**v2 change:** Original PRD centred on bulk PaySim import. Product now centres on **inline payment scoring**; PaySim remains the train/eval dataset.

### 3.5 Risk scoring engine (Java)

| ID | Requirement |
|----|-------------|
| **FR-17** | Weighted Customer Risk Score 0–100 (KYC + document + TX components) |
| **FR-18** | Human-readable explanation string |
| **FR-19** | Admin-configurable weights / thresholds per tenant |
| **FR-20** | Recalculate when new evidence arrives |

### 3.6 Case management & compliance desk

| ID | Requirement |
|----|-------------|
| **FR-21** | Case queue filterable/sortable by risk, date, status |
| **FR-22** | Customer 360° (documents, transactions, scores, history) |
| **FR-23** | Approve / Reject / Escalate with **mandatory** note |
| **FR-24** | Immutable AuditLog (who/what/when/before/after) |
| **FR-25** | Real-time case push via WebSocket (staff UI) |
| **FR-26** | Admin analytics (trends, tiers, model metrics surfaces) |
| **FR-29** | Object storage for media references (local volume acceptable early) |

---

## 4. Non-functional requirements

Canonical list: [nfr.md](nfr.md).

| ID | Requirement |
|----|-------------|
| **NFR-1** | Sync product APIs (auth, CRUD, TX score path) target &lt; ~300ms p95 under pilot load |
| **NFR-2** | Heavy CV inference async where needed — processing state + WebSocket and/or bank webhook |
| **NFR-3** | Uploads validated (type allow-list, max size) before storage/ML |
| **NFR-4** | Audit immutable — no update/delete APIs |
| **NFR-5** | Secrets never logged; sensitive identity fields encrypted at rest (target) |
| **NFR-6** | OpenAPI/Swagger for every product Spring endpoint |
| **NFR-7** | Data minimization; retention; subject-erase path for pilot/rightful deletion |
| **NFR-8** | Fail-closed KYC |
| **NFR-9** | Restartable services; health checks for continuous desk use |
| **NFR-10** | Media as object references, not unbounded DB blobs |

**Privacy / ethics:** Prefer synthetic IDs/cheques and PaySim for public demos. Real pilot PII stays in the bank’s controlled environment. Do **not** claim regulatory certification in product copy until an external process completes.

---

## 5. Data model (core)

Canonical detail: [data-model.md](data-model.md).

```
Tenant
  ├── User (staff)
  ├── TenantApiKey
  ├── RiskSettings
  ├── Customer ── KycSession
  │            ├── Document
  │            ├── Transaction
  │            └── Case
  └── AuditLog
```

| Entity | Essentials |
|--------|------------|
| **Tenant** | `code`, `name`, `enabled` |
| **TenantApiKey** | `keyPrefix`, `keyHash`, `enabled` |
| **Customer** | `externalCustomerId`, KYC scores/status, `riskScore`, `referenceSignatureUrl` |
| **KycSession** | challenge, status, link to Customer |
| **Document** | type, OCR JSON, tamper, signature status/score, fraud sub-score |
| **Transaction** | amount/currency/time/channel, anomaly, flags, SHAP, recommendation |
| **Case** | status, explanation, decision + note, risk snapshot |
| **AuditLog** | action, entity, before/after JSON |
| **User** | tenant-scoped username, BCrypt hash, role |
| **RiskSettings** | weights + thresholds |

---

## 6. API surface (representative)

Canonical tables: [api-contracts.md](api-contracts.md).

### Staff (JWT)

```
POST   /api/auth/login
POST   /api/auth/refresh
GET    /api/me
GET    /api/customers
GET    /api/customers/{id}
GET    /api/customers/{id}/risk-score
POST   /api/customers/{id}/signature-specimen
POST   /api/documents
GET    /api/documents/{id}
POST   /api/transactions/score
GET    /api/customers/{id}/transactions
GET    /api/cases
PATCH  /api/cases/{id}/decision
GET|PUT /api/admin/settings/risk-weights
GET    /api/admin/analytics/fraud-trend          (planned)
WS     /ws  → /topic/cases                      (planned)
```

### Bank integration (`X-Api-Key`)

```
POST   /api/tenants/register                    (public — one-time key)
POST   /api/integration/kyc/sessions
POST   /api/integration/kyc/sessions/{id}/submit
GET    /api/integration/kyc/sessions/{id}
POST   /api/integration/customers/{externalCustomerId}/signature-specimen
POST   /api/integration/documents
POST   /api/integration/transactions/score      (primary payment path)
POST   /api/integration/transactions/import     (backfill — planned)
```

### TX score response shape (illustrative)

```json
{
  "recommendation": "REVIEW",
  "anomalyScore": 0.82,
  "ruleFlags": ["AMOUNT_OUTLIER", "VELOCITY"],
  "explanation": "Amount outlier; elevated velocity",
  "shapTopFeatures": [
    { "feature": "amount_vs_avg_30d", "contribution": 0.31 }
  ],
  "customerRiskScore": 74,
  "caseId": "9"
}
```

---

## 7. CV / ML microservice contracts

Canonical: [ml-contracts.md](ml-contracts.md) · OpenAPI stubs in `docs/contracts/`.

| Service | Endpoint | Purpose |
|---------|----------|---------|
| CV/ML | `POST /cv/kyc-verify` | OCR + face + liveness (+ ID tamper) |
| CV/ML | `POST /cv/document-verify` | OCR + tamper + optional signature match |
| TX ML | `POST /ml/transaction-score` | Rules + model + SHAP for one or many TX |

Spring calls these via WebClient (target). Until Python is wired, the backend may use a **deterministic stub** (`sentinel.ml.stub=true`) so integration and desk flows remain demoable.

Async pattern (highlight in report): accept → `PENDING` → job → scores → risk → case → WebSocket/webhook.

---

## 8. Datasets

| Need | Source | Notes |
|------|--------|-------|
| Signatures | CEDAR | Genuine + forged pairs |
| Transactions | PaySim | Train/eval; bank-shaped fixtures for API tests |
| IDs / cheques | Synthetic templates | Avoid real PII in public repos |
| Invoices | SROIE or synthetic | OCR eval |
| Liveness | Controlled live/spoof sets | Anti-spoof eval |

Downloads under `datasets/` (gitignored); commit READMEs only.

---

## 9. Scope

### 9.1 Must build (pilot / FYP core)

- Auth + RBAC + refresh tokens  
- Multi-tenant model + API keys + tenant register  
- KYC sessions with fail-closed policy  
- Document fraud with specimen enrollment and honest skip  
- Real-time TX score + risk engine + auto cases  
- Case decisions + immutable audit  
- Staff desk (queue, 360°, live updates)  
- Spring ↔ Python integration (stub → real clients)  
- OpenAPI, health, documented architecture  

### 9.2 Build simplified (acceptable for FYP schedule)

- Early CV models may start with strong baselines before full production hardening  
- Liveness may begin as challenge + heuristic and mature to stronger anti-spoof  
- TX model: rules + GBM/IF on PaySim — do not over-build a custom DL payment model  
- Local filesystem for media before S3/MinIO  

### 9.3 Explicitly out of scope (state in report)

| Out | Why |
|-----|-----|
| Real regulatory **certification** | External process; build an evidence pack instead |
| Core banking / card-rail authorization | Sentinel advises; bank posts the payment |
| Consumer “signup on Sentinel” app | Product rule — customers stay on bank UX |
| Guaranteeing zero fraud | Risk reduction + auditability, not omniscience |

### 9.4 Scope delta from original v1.0 PRD

| Original v1.0 | Current v2.0 |
|---------------|--------------|
| Onboarding applicant uploads on Sentinel (simulated) | Bank channel + staff desk only |
| Multi-tenant “out of scope” | **In scope** — tenants, API keys, isolation |
| TX primarily bulk CSV + Isolation Forest | **Real-time score API** + rules + GBM + SHAP; bulk = backfill |
| Single-frame liveness OK as simplified | Challenge-based / fail-closed anti-spoof bar |
| Signature always scored | Specimen required; else `SKIPPED_NO_REFERENCE` |
| Single-institution implied | Multi-tenant from day one of domain model |

---

## 10. Timeline (12-week academic track)

Maps to pilot phases in [scope-and-timeline.md](scope-and-timeline.md).

| Weeks | Focus |
|-------|--------|
| 1–2 | Spring skeleton: auth, entities, schema, Swagger |
| 3–4 | CV: OCR + signature (CEDAR) |
| 5 | Spring ↔ Python (stub → WebClient + async) |
| 6 | Document fraud end-to-end + specimen flow |
| 7 | KYC sessions + liveness challenge |
| 8 | Real-time TX score + PaySim train/eval |
| 9 | Risk engine + auto cases + audit coverage |
| 10 | React staff desk: queue, 360°, WebSocket |
| 11 | Analytics, webhooks, object storage hardening |
| 12 | Metrics writeup, demo rehearsal, report |

Engineering progress may pull tenancy / integration APIs earlier than this table (already done in backend); the week plan remains the academic narrative spine.

---

## 11. Evaluation metrics

See [evaluation-metrics.md](evaluation-metrics.md).

| Area | Report |
|------|--------|
| Signature verification | Precision, recall, F1, ROC-AUC on CEDAR holdout |
| OCR | Field-level extraction accuracy |
| TX anomaly | Precision/recall vs PaySim labels; SHAP sanity examples |
| System | API latency p50/p95; upload→score end-to-end time |
| Product | Audit completeness on decisions; fail-closed KYC behaviour samples |

---

## 12. Demo script (defense / pilot story)

Canonical: [demo-script.md](demo-script.md).

1. **Narrative** — Client applies at the bank / bank app; bank starts a Sentinel KYC session + liveness challenge.  
2. **Enroll signature specimen** (required for match).  
3. **Genuine cheque** with specimen → clean path.  
4. **Forged / mismatched / no specimen** → Case + explanation (incl. `SKIPPED_NO_REFERENCE` if relevant).  
5. **Real-time TX** — payment switch calls score API → `ALLOW` / `REVIEW` / `BLOCK`.  
6. **Compliance** — decide case with note → AuditLog.  
7. **Admin** — risk weights / trends.  
8. **Integration** — show `X-Api-Key` path and tenant isolation.

This demonstrates full-stack ownership: security, tenancy, dual-channel APIs, ML integration, explainability, and audit/compliance thinking.

---

## 13. Implementation status (snapshot)

Honest engineering status — update as modules land.

| Area | Status |
|------|--------|
| Staff JWT auth + refresh + seed users | Done |
| Multi-tenant entities + register + hashed API keys | Done |
| KYC sessions, specimen, document verify (stub ML) | Done |
| Real-time TX score, risk engine, cases, audit, risk settings | Done |
| OpenAPI / health / module docs | Done |
| Marketing React landing | Done |
| `MlGateway` (stub + RestClient to Python with fallback) | Done |
| WebSocket STOMP case push | Done |
| Bulk TX CSV import | Done |
| Outbound webhooks + admin webhook settings | Done |
| Admin analytics + audit list + ID field encryption | Done |
| Multipart upload variants | Done |
| Staff React desk UI | Planned |
| Trained CV/TX models in Python services | Planned |

---

## 14. Document control

| Version | Notes |
|---------|--------|
| 1.0 | Original FYP scaffold PRD (consumer-upload framing; multi-tenant deferred; bulk TX primary) |
| **2.0** | Bank-integration product PRD aligned with current vision, architecture, and implemented backend surface |

When requirements conflict, **this PRD (v2) + product-vision.md** win over older scaffold wording in READMEs.
