# Audit module

**Owns:** immutable who/what/when for compliance decisions and policy changes.  
**Requirements:** FR-24 · NFR-4.

## What this module is

Banks must reconstruct decisions. `AuditLog` is append-only (insert + read only). Typical producers: case decisions, risk settings changes, sensitive admin actions.

## What’s here now

`AuditLog` + `AuditLogRepository`. Writers wired as APIs land.
