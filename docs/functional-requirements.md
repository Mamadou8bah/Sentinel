# Functional requirements index

| ID | Summary | Owner |
|----|---------|-------|
| FR-1 | Role-based login (JWT) | backend/auth |
| FR-2 | BCrypt passwords | backend/auth |
| FR-3 | `@PreAuthorize` RBAC | backend/auth |
| FR-4 | Access + refresh token expiry | backend/auth |
| FR-5 | Upload ID + selfie | backend/customer + frontend |
| FR-6 | CV KYC (OCR, tamper, face, liveness) | services/cv-ml |
| FR-7 | Store profile + scores | backend/customer |
| FR-8 | Auto-create Case below threshold | backend/risk + casemanagement |
| FR-9 | Upload cheque/invoice | backend/document |
| FR-10 | CV document verify | services/cv-ml |
| FR-11 | Store Document + fraud score | backend/document |
| FR-12 | Auto-flag cases | backend/casemanagement |
| FR-13 | Bulk CSV import | backend/transaction |
| FR-14 | TX scoring | services/transaction-ml |
| FR-15 | Store Transaction + scores | backend/transaction |
| FR-16 | Aggregate TX risk | backend/risk |
| FR-17 | Weighted Customer Risk Score 0–100 | backend/risk |
| FR-18 | Human-readable explanation | backend/risk |
| FR-19 | Configurable thresholds/weights | backend/admin |
| FR-20 | Recalc on new evidence | backend/risk |
| FR-21 | Case queue filter/sort | backend/casemanagement + frontend |
| FR-22 | Customer 360° | backend/customer + frontend |
| FR-23 | Approve/Reject/Escalate + note | backend/casemanagement |
| FR-24 | Immutable AuditLog | backend/audit |
| FR-25 | WebSocket live cases | backend/websocket + frontend |
| FR-26 | Admin analytics | backend/admin + frontend |
