# Integration module

**Owns:** bank-facing HTTP (`/api/integration/**`), ML scoring glue, outbound webhooks.

## What’s here now

| Piece | Role |
|-------|------|
| `IntegrationController` | KYC, specimen, documents, TX score, CSV import, multipart |
| `MlGateway` | Stub or RestClient to Python; falls back to stub on failure |
| `StubMlService` | Deterministic scores for local demos |
| `WebhookPublisher` | Async POST to tenant `webhookUrl` |

Auth: `ApiKeyAuthFilter` (`X-Api-Key`) → `ROLE_INTEGRATION`.

Set `SENTINEL_ML_STUB=false` when Python services are up.
