# Backend — Sentinel Spring Boot core

Bank compliance **system of record**: auth, multi-tenant isolation, KYC, documents, real-time TX scoring, risk, cases, audit, WebSocket, webhooks.

**Package layout:** nested `model/` · `repository/` · `service/` · `controller/` · `dto/` per module — see [ARCHITECTURE.md](ARCHITECTURE.md).

Vision: [docs/product-vision.md](../docs/product-vision.md) · PRD: [docs/prd.md](../docs/prd.md) · contracts: [docs/api-contracts.md](../docs/api-contracts.md).

## Module map

| Package | Responsibility |
|---------|----------------|
| [`tenant`](src/main/java/com/sentinel/tenant) | Register, API keys, webhook URL |
| [`auth`](src/main/java/com/sentinel/auth) | Staff JWT, RBAC, seeder |
| [`customer`](src/main/java/com/sentinel/customer) | KYC sessions, specimen, 360° |
| [`document`](src/main/java/com/sentinel/document) | Document verify + signature skip |
| [`transaction`](src/main/java/com/sentinel/transaction) | Live score + CSV import |
| [`casemanagement`](src/main/java/com/sentinel/casemanagement) | Queue, decisions, WS/webhook events |
| [`audit`](src/main/java/com/sentinel/audit) | Append-only trail + list API |
| [`risk`](src/main/java/com/sentinel/risk) | Weights, recommendations |
| [`admin`](src/main/java/com/sentinel/admin) | Risk weights, analytics, webhook settings |
| [`integration`](src/main/java/com/sentinel/integration) | Bank APIs, `MlGateway`, webhooks |
| [`websocket`](src/main/java/com/sentinel/websocket) | STOMP `/ws` case push |
| [`common`](src/main/java/com/sentinel/common) | OpenAPI, `.env`, storage, field encryption |

## Run

```bash
docker compose up -d postgres
cd backend
mvn spring-boot:run
```

H2 (no Docker):

```bash
mvn spring-boot:run "-Dspring-boot.run.profiles=h2"
```

## Demo credentials

| Channel | Credential |
|---------|------------|
| Staff | `admin` / `compliance` / `analyst` — `ChangeMe123!` |
| Integration | `X-Api-Key: sen_demo_bank_local_dev_key_do_not_use_prod` |

## Implemented surface

| Area | Paths |
|------|-------|
| Auth | `/api/auth/*`, `/api/me` |
| Tenants | `POST /api/tenants/register` |
| Integration | KYC, specimen, documents (+ multipart), TX score, TX CSV import |
| Staff | customers, documents, cases, TX score/import, audit |
| Admin | risk-weights, fraud-trend analytics, webhook settings + test |
| Real-time | STOMP `/ws` → `/topic/cases` |
| Ops | Swagger, actuator health |

ML: `sentinel.ml.stub=true` by default (`MlGateway` falls back to stub if Python is down).

## Config highlights

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Access-token signing |
| `FIELD_ENCRYPTION_KEY` | AES key material for ID numbers |
| `SENTINEL_ML_STUB` | Stub vs live Python |
| `CV_ML_BASE_URL` / `TRANSACTION_ML_BASE_URL` | Python services |
| `UPLOAD_DIR` / `UPLOAD_MAX_SIZE_MB` | Local media |
