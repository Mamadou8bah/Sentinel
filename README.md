# Sentinel

AI-powered KYC & fraud prevention platform for a computer science final-year project.

**Stack:** Java 21 / Spring Boot 3 (core API) · Python FastAPI (CV/ML) · PostgreSQL · React + TypeScript  
**Status:** Scaffold only — no application code yet.

## Product vision

Unified platform for bank compliance and fraud teams to:

1. Verify customer identity (KYC)
2. Detect document fraud (cheques / invoices)
3. Monitor transactions for anomalies
4. Review a single explainable customer risk score in one case-management dashboard

## Repository layout

```
sentinel/
├── backend/                 Spring Boot API gateway / core (auth, domain, risk, cases, audit)
├── services/
│   ├── cv-ml/               FastAPI — OCR, signature, tampering, face/liveness
│   └── transaction-ml/      FastAPI — rules + Isolation Forest scoring
├── frontend/                React SPA — dashboard, case queue, analytics
├── datasets/                CEDAR, PaySim, synthetic docs (download locally; not committed)
├── docs/                    Architecture, contracts, scope, demo script
├── scripts/                 Training / data / ops scripts (later)
└── docker-compose.yml       Local Postgres (+ optional RabbitMQ profile)
```

## Why this split

| Layer | Owns |
|--------|------|
| Spring Boot | Auth, workflow, persistence, audit trail, risk engine, APIs, WebSockets |
| Python CV/ML | Inference only (OCR, signature, tampering, face) |
| Python TX/ML | Transaction rule flags + Isolation Forest |
| React | Compliance UX, real-time case updates |

Banks routinely run polyglot systems like this; the FYP demo mirrors that shape without production regulatory claims.

## Target users

| Role | Responsibility |
|------|----------------|
| Admin | Users, analytics, risk weight/threshold config |
| Compliance Officer | Case review, approve/reject/escalate + notes |
| Fraud Analyst | Document / transaction anomaly investigation |
| Onboarding Applicant | Simulated ID + selfie upload (demo) |

## Build phases (implementation later)

See [docs/scope-and-timeline.md](docs/scope-and-timeline.md). Short version:

1. Backend skeleton (auth, entities, Swagger)
2. CV microservice (OCR + CEDAR signature model)
3. Spring ↔ Python async integration
4. Document fraud E2E → KYC (simplified) → transactions
5. Risk engine + case auto-creation
6. React dashboard + WebSockets
7. Analytics, audit viewer, metrics, demo

## Local infra (scaffold)

```bash
cp .env.example .env
docker compose up -d postgres
# Optional messaging:
# docker compose --profile async up -d rabbitmq
```

App services are stubbed in `docker-compose.yml` until code exists.

## Documentation map

| Doc | Purpose |
|-----|---------|
| [docs/architecture.md](docs/architecture.md) | High-level design & async pattern |
| [docs/data-model.md](docs/data-model.md) | Core JPA entities |
| [docs/api-contracts.md](docs/api-contracts.md) | Spring REST + STOMP surface |
| [docs/ml-contracts.md](docs/ml-contracts.md) | Python FastAPI contracts |
| [docs/scope-and-timeline.md](docs/scope-and-timeline.md) | Must-build / simplified / out-of-scope + 12-week plan |
| [docs/evaluation-metrics.md](docs/evaluation-metrics.md) | Metrics to report for credibility |
| [docs/demo-script.md](docs/demo-script.md) | Defense / interview demo flow |
| [docs/nfr.md](docs/nfr.md) | Non-functional requirements |

## License / academic use

Final-year project scaffold. Synthetic PII only — see GDPR note in `docs/nfr.md`.
