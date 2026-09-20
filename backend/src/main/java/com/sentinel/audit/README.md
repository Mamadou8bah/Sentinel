# Audit module

**Owns:** append-only compliance trail (NFR-4).

## What’s here now

- `AuditLog` entity + save/find repository (no update/delete methods)
- `AuditService.record(...)` used by tenant register, KYC, specimen, documents, TX score, case open/decide, risk settings

Actor `userId` is null for bank API-key actions.
