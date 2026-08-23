# Backend — Sentinel Spring Boot core

Bank compliance **system of record**: auth, domain entities, risk, cases, audit.  
Vision: [docs/product-vision.md](../docs/product-vision.md).

## Module map

| Package | Responsibility |
|---------|----------------|
| [`tenant`](src/main/java/com/sentinel/tenant) | Bank institutions (multi-tenant isolation) |
| [`auth`](src/main/java/com/sentinel/auth) | Staff login, JWT, roles (bank service creds later) |
| [`customer`](src/main/java/com/sentinel/customer) | Bank client KYC subject + scores |
| [`document`](src/main/java/com/sentinel/document) | Cheque/invoice fraud evidence |
| [`transaction`](src/main/java/com/sentinel/transaction) | TX history + anomaly flags |
| [`casemanagement`](src/main/java/com/sentinel/casemanagement) | Staff review queue + decisions |
| [`audit`](src/main/java/com/sentinel/audit) | Append-only compliance trail |
| [`risk`](src/main/java/com/sentinel/risk) | Weights, thresholds, score + fail-closed policy |
| [`admin`](src/main/java/com/sentinel/admin) | Settings + analytics |
| [`integration`](src/main/java/com/sentinel/integration) | ML clients + bank webhooks (P1) |
| [`websocket`](src/main/java/com/sentinel/websocket) | Live case push to staff UI |
| [`common`](src/main/java/com/sentinel/common) | OpenAPI, errors, `/api/me` |

## Run (Postgres via Docker)

```bash
docker compose up -d postgres
cd backend
mvn spring-boot:run
```

## Run without Docker (H2)

```bash
cd backend
mvn spring-boot:run "-Dspring-boot.run.profiles=h2"
```

## Demo staff users

Seeded under tenant `demo-bank`:

| Username | Role | Password |
|----------|------|----------|
| `admin` | ADMIN | `ChangeMe123!` |
| `compliance` | COMPLIANCE | `ChangeMe123!` |
| `analyst` | ANALYST | `ChangeMe123!` |

Schema: Hibernate `ddl-auto: update` (Flyway disabled for now). Fresh Postgres DB if the model drifts badly.

## Endpoints (Day 2)

- Swagger: http://localhost:8080/swagger-ui.html
- `POST /api/auth/login` · `POST /api/auth/refresh` · `GET /api/me` · `GET /actuator/health`
