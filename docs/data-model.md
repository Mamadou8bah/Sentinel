# Data model (core entities)

Authoritative Postgres model for the bank compliance platform. Glossary: [product-vision.md](product-vision.md) — `User` = staff; `Customer` = bank’s client.

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
| livenessScore | Double | 0–1 from anti-spoof challenge/video |
| riskScore | Integer | 0–100 overall |
| externalCustomerId | String | optional bank-core reference (P1) |
| referenceSignatureUrl | String | enrolled specimen object key (required for signature *match*) |
| createdAt | Instant | |

## Document

| Field | Type | Notes |
|-------|------|--------|
| id | UUID/Long | PK |
| customerId | FK | |
| type | Enum | CHEQUE / INVOICE / ID |
| ocrExtractedData | JSON | amount, date, payee, etc. |
| signatureMatchStatus | Enum | SCORED / SKIPPED_NO_REFERENCE |
| signatureMatchScore | Double | 0–1; null if skipped |
| tamperingScore | Double | 0–1; image-level, no prior specimen needed |
| fieldConsistencyFlags | JSON | e.g. payee vs customer name |
| fraudRiskScore | Double | sub-score |
| imageUrl | String | stored path / object key |
| status | Enum | PENDING / COMPLETE / FAILED |
| createdAt | Instant | |

## Transaction

| Field | Type | Notes |
|-------|------|--------|
| id | UUID/Long | PK |
| customerId | FK | |
| externalTransactionId | String | bank’s TX id (idempotency) |
| amount | BigDecimal | |
| timestamp | Instant | |
| channel | String | MOBILE / BRANCH / ATM / … |
| location | String | |
| anomalyScore | Double | from real-time score API |
| flagged | boolean | |
| recommendation | Enum | ALLOW / REVIEW / BLOCK |

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

## Schema

JPA entities drive the schema via Hibernate `ddl-auto: update` (Flyway disabled for now).  
Optional SQL sketch (not applied): `backend/src/main/resources/db/migration/V1__init.sql`.  
Demo rows: `DataSeeder` (`demo-bank`, staff users, risk settings).
