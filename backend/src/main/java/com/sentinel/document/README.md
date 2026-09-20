# Document fraud module

**Owns:** cheque/invoice verification evidence.

## What’s here now

- `POST /api/integration/documents` and staff `POST /api/documents`
- Signature match only when a specimen exists → otherwise `SKIPPED_NO_REFERENCE`
- Stub OCR + tampering scores; case opened when suspicious

Related: customer specimen enroll, risk engine thresholds.
