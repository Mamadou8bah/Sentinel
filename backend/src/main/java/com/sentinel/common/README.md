# Common module

**Owns:** shared HTTP/product plumbing — OpenAPI, errors, later encryption/upload helpers (NFR-3, NFR-5, NFR-6).

## What’s here now

| Class | Purpose |
|-------|---------|
| `OpenApiConfig` | “Sentinel API” + JWT bearer for Swagger |
| `GlobalExceptionHandler` | Consistent API errors |
| `MeController` | `GET /api/me` staff identity smoke test |

Not a domain table owner. Bank clients are never authenticated here.
