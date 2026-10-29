# Integration module

**Owns:** bank-facing HTTP (`/api/integration/**`), ML scoring glue, outbound webhooks.

## What’s here now

| Piece | Role |
|-------|------|
| `IntegrationController` | KYC, specimen, documents, TX score, CSV import, multipart |
| `MlGateway` | Explicit local stub or authenticated Python calls; live failures never fall back to stub |
| `StubMlService` | Deterministic scores for local demos |
| `WebhookPublisher` | Async POST to tenant `webhookUrl` |

Auth: `ApiKeyAuthFilter` (`X-Api-Key`) → `ROLE_INTEGRATION`.

Set `SENTINEL_ML_STUB=false` when Python services are up. Render always disables
stubs. `SENTINEL_ML_ENABLED=false` allows API deployment before ML hosting, while
all inference and challenge requests return 503. Enable it only after configuring
both real service URLs and their shared API key.
