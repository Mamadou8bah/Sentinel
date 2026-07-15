# Backend — Spring Boot core (scaffold)

**Package root:** `com.sentinel`  
**Stack:** Java 21, Spring Boot 3.x, Security+JWT, Data JPA, WebSocket STOMP, springdoc-openapi  
**Status:** Structure + dependency manifest only — no Java sources yet.

## Planned packages

| Package | Responsibility | FR |
|---------|----------------|-----|
| `auth` | Login, refresh, RBAC | FR-1–4 |
| `customer` | KYC onboarding orchestration | FR-5–8 |
| `document` | Cheque/invoice fraud orchestration | FR-9–12 |
| `transaction` | CSV import + persistence | FR-13–16 |
| `risk` | Weighted score + explanation | FR-17–20 |
| `casemanagement` | Queue, decisions | FR-21–25 |
| `audit` | Immutable audit trail | FR-24 |
| `admin` | Analytics + risk weights | FR-19, FR-26 |
| `websocket` | STOMP case notifications | FR-25 |
| `integration` | WebClient to Python services | — |
| `common` | shared DTOs, errors, crypto helpers | — |

## Source layout

```
src/main/java/com/sentinel/{module}/
src/main/resources/application.yml          # add when implementing
src/main/resources/db/migration/            # Flyway SQL later
src/test/java/com/sentinel/                 # JUnit5 + Mockito + Testcontainers
```

## Next implementation step (weeks 1–2)

1. Generate Spring Boot app into this folder (or hand-write main + config).
2. Wire PostgreSQL + JWT security skeleton.
3. Map entities from `docs/data-model.md`.
4. Enable Swagger UI.

Do **not** implement CV models here — call `services/cv-ml` and `services/transaction-ml`.
