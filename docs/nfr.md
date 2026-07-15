# Non-functional requirements

| ID | Requirement |
|----|-------------|
| NFR-1 | Sync API (auth, CRUD) responses under ~300ms |
| NFR-2 | CV/ML inference async — UI shows processing; result via WebSocket |
| NFR-3 | Uploads validated (file type, size) before processing |
| NFR-4 | Audit log immutable — no update/delete endpoints |
| NFR-5 | Passwords & JWT secrets never logged; sensitive fields encrypted at rest |
| NFR-6 | Every Spring endpoint documented with OpenAPI / Swagger |
| NFR-7 | GDPR note for report: data minimization; right-to-erasure for **demo** data; synthetic IDs only |

## GDPR / ethics note (demo)

- Prefer synthetic documents and PaySim — avoid real customer PII.
- Document data retention for the demo DB and a simple erase path for demo subjects.
- State clearly: not a certified production KYC system.
