# Functional requirements index

Product context: [product-vision.md](product-vision.md).

| ID | Summary | Owner |
|----|---------|-------|
| FR-1 | Role-based staff login (JWT) | backend/auth |
| FR-2 | BCrypt passwords | backend/auth |
| FR-3 | `@PreAuthorize` RBAC | backend/auth |
| FR-4 | Access + refresh token expiry | backend/auth |
| FR-5 | Capture ID + selfie / liveness challenge response | backend/customer + frontend + bank channel |
| FR-6 | CV KYC (OCR, tamper, face match, anti-spoof liveness) | services/cv-ml |
| FR-7 | Store profile + scores (encrypted sensitive fields) | backend/customer |
| FR-8 | Auto-create Case when policy thresholds breached | backend/risk + casemanagement |
| FR-9 | Enroll reference signature specimen; upload cheque/invoice | backend/document + customer |
| FR-10 | CV document verify (tamper + OCR; signature match iff specimen exists) | services/cv-ml |
| FR-11 | Store Document + fraud scores; SKIPPED match when no specimen | backend/document |
| FR-12 | Auto-flag document cases | backend/casemanagement |
| FR-13 | Real-time per-TX score API for bank payment path | backend/transaction |
| FR-14 | TX scoring (rules + boosted/anomaly model + SHAP) | services/transaction-ml |
| FR-15 | Store Transaction + scores + recommendation | backend/transaction |
| FR-16 | Aggregate TX risk into customer score | backend/risk |
| FR-13b | Bulk TX import for backfill / training only | backend/transaction |
| FR-17 | Weighted Customer Risk Score 0–100 | backend/risk |
| FR-18 | Human-readable explanation | backend/risk |
| FR-19 | Configurable thresholds/weights | backend/admin |
| FR-20 | Recalc on new evidence | backend/risk |
| FR-21 | Case queue filter/sort | backend/casemanagement + frontend |
| FR-22 | Customer 360° | backend/customer + frontend |
| FR-23 | Approve/Reject/Escalate + mandatory note | backend/casemanagement |
| FR-24 | Immutable AuditLog | backend/audit |
| FR-25 | WebSocket live cases | backend/websocket + frontend |
| FR-26 | Admin analytics | backend/admin + frontend |
| FR-27 | Bank service credentials for integration APIs | backend/auth (P1) |
| FR-28 | KYC session status + outbound webhooks to bank | backend/integration (P1) |
| FR-29 | Object storage for media references | backend + infra (P1; local volume early P0) |
| FR-30 | Fail-closed KYC on spoof / poor quality | backend/risk + customer |
