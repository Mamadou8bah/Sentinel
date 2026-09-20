# Data model (core entities)

Authoritative Postgres model for the bank compliance platform. Glossary: [product-vision.md](product-vision.md) — `User` = staff; `Customer` = bank’s client.

## Entity relationship (conceptual)

```
Tenant ── User (staff)
       ├── TenantApiKey
       ├── RiskSettings
       ├── Customer ── KycSession
       │            ├── Document
       │            ├── Transaction
       │            └── Case
       └── AuditLog
```

## Tenant

| Field | Type | Notes |
|-------|------|--------|
| id | Long | PK |
| code | String | unique slug (`demo-bank`) |
| name | String | display name |
| enabled | boolean | |
| createdAt | Instant | |

## TenantApiKey

| Field | Type | Notes |
|-------|------|--------|
| id | Long | PK |
| tenantId | FK | |
| keyPrefix | String | first 12 chars for lookup |
| keyHash | String | SHA-256 of raw key (unique) |
| name | String | e.g. `primary` |
| enabled | boolean | |
| createdAt / lastUsedAt | Instant | |

Raw key shown **once** at register/seed time.

## Customer

| Field | Type | Notes |
|-------|------|--------|
| id | Long | PK |
| tenantId | FK | |
| name | String | from OCR / form |
| dob | LocalDate | |
| idNumber | String | opaque for now; encrypt later |
| kycStatus | Enum | PENDING / VERIFIED / FLAGGED / REJECTED |
| faceMatchScore | Double | 0–1 |
| livenessScore | Double | 0–1 |
| riskScore | Integer | 0–100 overall |
| externalCustomerId | String | bank-core reference (unique per tenant) |
| referenceSignatureUrl | String | specimen path (required for signature *match*) |
| createdAt | Instant | |

## KycSession

| Field | Type | Notes |
|-------|------|--------|
| id | Long | PK |
| tenantId | FK | |
| externalCustomerId | String | |
| customerId | FK nullable | set on submit |
| status | Enum | PENDING / SUBMITTED / COMPLETE / FAILED |
| challengeId | String | liveness challenge token |
| livenessHint | String | human instruction |
| explanation | Text | |
| createdAt / updatedAt | Instant | |

## Document

| Field | Type | Notes |
|-------|------|--------|
| id | Long | PK |
| tenantId / customerId | FK | |
| type | Enum | CHEQUE / INVOICE / ID |
| ocrExtractedData | JSON | amount, date, payee, etc. |
| signatureMatchStatus | Enum | PENDING / SCORED / SKIPPED_NO_REFERENCE |
| signatureMatchScore | Double | null if skipped |
| tamperingScore | Double | 0–1 |
| fieldConsistencyFlags | JSON list | e.g. payee mismatch |
| fraudRiskScore | Double | sub-score |
| imageUrl | String | local path / object key |
| status | Enum | PENDING / COMPLETE / FAILED |
| createdAt | Instant | |

## Transaction

| Field | Type | Notes |
|-------|------|--------|
| id | Long | PK |
| tenantId / customerId | FK | |
| externalTransactionId | String | bank TX id (idempotency per tenant) |
| amount | BigDecimal | |
| currency | String | default GMD |
| occurredAt | Instant | |
| channel / location / counterparty | String | |
| anomalyScore | Double | |
| flagged | boolean | |
| recommendation | Enum | ALLOW / REVIEW / BLOCK |
| explanation | Text | |
| ruleFlags | JSON list | |
| shapTopFeatures | JSON list | `{ feature, contribution }` |

## Case

| Field | Type | Notes |
|-------|------|--------|
| id | Long | PK |
| tenantId / customerId | FK | |
| relatedDocumentId | FK nullable | |
| status | Enum | OPEN / UNDER_REVIEW / RESOLVED |
| riskScoreAtCreation | Integer | snapshot |
| explanation | Text | |
| assignedTo | FK User nullable | |
| decision | Enum nullable | APPROVE / REJECT / ESCALATE |
| decisionNote | Text | mandatory on decision |
| createdAt / updatedAt | Instant | |

## AuditLog (immutable)

| Field | Type | Notes |
|-------|------|--------|
| id | Long | PK |
| tenantId | FK | |
| userId | FK nullable | null for API-key actions |
| action | String | e.g. CASE_DECIDE, TX_SCORE |
| entityType / entityId | String | |
| beforeState / afterState | JSON | |
| createdAt | Instant | |

**NFR-4:** no update/delete repository methods or endpoints.

## User (staff)

| Field | Type | Notes |
|-------|------|--------|
| id | Long | PK |
| tenantId | FK | |
| username | String | unique per tenant |
| passwordHash | String | BCrypt |
| role | Enum | ADMIN / COMPLIANCE / ANALYST |
| enabled | boolean | |

## RiskSettings

Per-tenant weights (`kycWeight`, `documentWeight`, `transactionWeight`) and thresholds (`faceMatchThreshold`, `signatureMatchThreshold`, `tamperingThreshold`, `anomalyThreshold`, `autoFlagRiskScore`).

## Schema

JPA entities drive the schema via Hibernate `ddl-auto: update` (Flyway disabled for now).  
Optional SQL sketch (not applied): `backend/src/main/resources/db/migration/V1__init.sql`.  
Demo rows: `DataSeeder` (`demo-bank`, staff users, risk settings, demo API key).
