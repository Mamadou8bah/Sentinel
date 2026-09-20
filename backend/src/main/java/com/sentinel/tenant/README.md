# Tenant module

**Owns:** bank institutions, self-serve registration, hashed service API keys.

## What’s here now

- `Tenant` entity + repository
- `POST /api/tenants/register` — creates tenant, admin user, risk settings, one-time API key
- `TenantApiKey` (prefix + SHA-256 hash) + `ApiKeyAuthFilter` for `/api/integration/**`
- Demo key seeded for `demo-bank` (see backend README)

## Related

- Staff users live in `auth` and always belong to a tenant
- Every domain row carries `tenant_id` for isolation
