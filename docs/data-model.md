# Data model (core entities)

Spring Data JPA entities — implement later. This doc is the scaffold contract.

## Entity relationship (conceptual)

```
User ───────────────┐
                    │ assignedTo
Customer ───┬────── Case
            ├── Document
            ├── Transaction
            └── (riskScore fields on Customer)

User ─────── AuditLog
```

## Customer

| Field | Type | Notes |
|-------|------|--------|
| id | UUID/Long | PK |
| name | String | from OCR / form |
| dob | LocalDate | |
| idNumber | String | **encrypted at rest** |
| kycStatus | Enum | PENDING / VERIFIED / FLAGGED / REJECTED |
| faceMatchScore | Double | 0–1 |
| livenessScore | Double | 0–1 |
| riskScore | Integer | 0–100 overall |
| createdAt | Instant | |

## Document

| Field | Type | Notes |
|-------|------|--------|
| id | UUID/Long | PK |
| customerId | FK | |
| type | Enum | CHEQUE / INVOICE / ID |
| ocrExtractedData | JSON | amount, date, payee, etc. |
| signatureMatchScore | Double | 0–1 |
| tamperingScore | Double | 0–1 |
| fraudRiskScore | Double | sub-score |
| imageUrl | String | stored path / object key |
| status | Enum | PENDING / COMPLETE / FAILED |
| createdAt | Instant | |

## Transaction

| Field | Type | Notes |
|-------|------|--------|
| id | UUID/Long | PK |
| customerId | FK | |
| amount | BigDecimal | |
| timestamp | Instant | |
| location | String | |
| anomalyScore | Double | |
| flagged | boolean | |

## Case

| Field | Type | Notes |
|-------|------|--------|
| id | UUID/Long | PK |
| customerId | FK | |
| relatedDocumentId | FK nullable | |
| status | Enum | OPEN / UNDER_REVIEW / RESOLVED |
| riskScoreAtCreation | Integer | snapshot |
| explanation | Text | human-readable |
| assignedTo | FK User nullable | |
| decision | Enum nullable | APPROVE / REJECT / ESCALATE |
| decisionNote | Text | mandatory on decision |
| createdAt / updatedAt | Instant | |

## AuditLog (immutable)

| Field | Type | Notes |
|-------|------|--------|
| id | UUID/Long | PK |
| userId | FK | actor |
| action | String | e. and. CASE_DECIDE |
| entityType | String | |
| entityId | String | |
| beforeState | JSON | |
| afterState | JSON | |
| timestamp | Instant | |

**NFR-4:** no update/delete repository methods or endpoints.

## User

| Field | Type | Notes |
|-------|------|--------|
| id | UUID/Long | PK |
| username | String | unique |
| passwordHash | String | BCrypt |
| role | Enum | ADMIN / COMPLIANCE / ANALYST |
| enabled | boolean | |

## Supporting / settings (suggested)

| Entity | Purpose |
|--------|---------|
| RiskSettings | Weightings + thresholds (Admin configurable) |
| RefreshToken | Refresh token persistence (FR-4) |

## Schema migrations

Place Flyway (or Liquibase) scripts under:

`backend/src/main/resources/db/migration/`

Naming convention: `V1__init.sql`, `V2__...` — write when implementing entities.
