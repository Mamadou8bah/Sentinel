# Sentinel platform administration

Platform owners sign in at `/platform/login` with username/password and no tenant
code. Tenant staff still sign in at `/desk/login`. They are distinct identities:
platform accounts live in `platform_accounts`, use JWT scope `platform`, and are
accepted only by `/api/platform/*`. Tenant JWTs and integration API keys cannot
call platform APIs. Platform JWTs cannot access tenant customer evidence or case
decision APIs. Use an authorised tenant staff login for that work.

The operator area provides a real overview, searchable/paginated tenant directory,
tenant creation and suspension, webhook endpoint settings, tenant staff creation,
role/access changes, password reset, integration key issuance/revocation, an
append-only operator audit log, and operator password change/sign-out. Destructive
changes require a reason; tenant suspension also requires its code. The last
enabled tenant admin is protected. No tenant is deleted by these APIs.

New tenant credentials and new API keys are displayed once. Metadata and audit
records never expose password hashes, raw keys or callback signing secrets.
Suspension immediately blocks tenant JWTs and service keys. Staff changes/reset
revoke access and refresh sessions; operator password change and sign-out revoke
previous platform tokens. Platform sessions use sessionStorage, expire with the
configured access JWT (15 minutes by default), and have no silent refresh or demo
fallback. A disconnected privileged write is never replayed automatically.

## First operator

Apply migrations before provisioning: Render migration V3 (normal profile V2)
creates platform tables and adds `users.auth_version` without elevating tenant
admins or invalidating unchanged version-zero staff sessions.

For an initial deployment, set private server environment variables:

```
SENTINEL_PLATFORM_BOOTSTRAP_ENABLED=true
SENTINEL_PLATFORM_ADMIN_USERNAME=admin
SENTINEL_PLATFORM_ADMIN_PASSWORD=<new separate password, at least 14 characters>
```

The bootstrap only creates the first account when no platform account exists. It
never resets an existing account, and no default password or public bootstrap API
exists. Disable bootstrap after provisioning. BCrypt inputs are limited to 72
UTF-8 bytes. Login attempts are bounded per remote address on each server instance.

For an already deployed instance, the operator can provision through its private
database configuration without adding a public bootstrap endpoint:

```powershell
python -m pip install "psycopg[binary]" bcrypt
python scripts/bootstrap_platform_admin.py --env backend/.env --credentials-file ../.local-validation/sentinel-platform-access.txt
```

The script creates only the first operator, hashes its password, records bootstrap
in the operator audit, and writes login details outside the repository. It uses
`SENTINEL_PLATFORM_ADMIN_USERNAME/PASSWORD` from that private environment, or
generates a strong password when absent. Existing platform accounts are never
modified. Normal deployment migrations remain the only schema runner.

## API

All paths are under `/api/platform`. Only `/auth/login` is public.

| Method/path | Behaviour |
| --- | --- |
| POST `/auth/login` | Operator username/password → scoped access token |
| POST `/auth/logout` | Revoke existing operator tokens |
| POST `/auth/password` | Current/new password; revoke old tokens and return a new token |
| GET `/me`, `/summary` | Current operator and platform totals |
| GET/POST `/tenants` | Paginated search / create a tenant and initial admin |
| GET/PUT `/tenants/{id}` | Tenant metadata / update access and callback URL |
| POST `/tenants/{id}/staff` | Create tenant staff |
| PUT `/tenants/{id}/staff/{staffId}` | Change tenant staff role/access |
| POST `/tenants/{id}/staff/{staffId}/password` | Reset staff password; revoke sessions |
| POST `/tenants/{id}/keys` | Issue one-time integration key |
| POST `/tenants/{id}/keys/{keyId}/revoke` | Revoke integration key immediately |
| POST `/tenants/{id}/webhook-secret` | Rotate signing secret; show the replacement once |
| GET `/audit` | Paginated operator audit, newest first |
