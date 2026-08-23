# Non-functional requirements

| ID | Requirement |
|----|-------------|
| NFR-1 | Sync API (auth, CRUD, status) responses under ~300ms p95 under pilot load |
| NFR-2 | CV/ML inference async — clients see processing; completion via WebSocket and/or bank webhook |
| NFR-3 | Uploads validated (MIME/type allow-list, max size) before storage or ML |
| NFR-4 | Audit log immutable — no update/delete APIs or repository mutators |
| NFR-5 | Passwords & JWT/API secrets never logged; identity fields (e.g. ID number) **encrypted at rest** |
| NFR-6 | Every product Spring endpoint documented with OpenAPI / Swagger |
| NFR-7 | Data minimization; documented retention; subject-erase path for pilot/rightful deletion requests |
| NFR-8 | Fail-closed KYC: ambiguous quality/liveness/spoof → do not auto-VERIFY |
| NFR-9 | Pilot availability target: designed for continuous ops desk use (health checks, restartable services) |
| NFR-10 | Media (ID/selfie/docs/liveness clips) stored as object references, not unbounded DB blobs |

## Privacy & ethics

- Prefer synthetic documents and PaySim for public demos and training writeups; real pilot PII stays in the bank’s controlled environment.
- Document retention and erase procedures in ops notes.
- Product stance: **pilot-grade bank platform**. Regulatory **certification** is a separate external process supported by an evidence pack (metrics, audit samples, threat notes) — not claimed by default in marketing copy.
