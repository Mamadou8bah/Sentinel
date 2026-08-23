# Auth module

**Owns:** who can use the product API, and how they prove it.  
**Requirements:** FR-1–4 (staff); FR-27 (bank service credentials, P1).

## What this module is

Sentinel is run **by the bank**. People who log in are **staff** (`User`), not the bank’s retail clients. This package is the gate: Spring Security + JWT (and later service credentials for bank systems).

Bank clients never register here — see `docs/product-vision.md`.

## Roles (staff)

| Role | Typical use |
|------|-------------|
| `ADMIN` | Settings, analytics, full access |
| `COMPLIANCE` | Case decisions (approve / reject / escalate) |
| `ANALYST` | KYC uploads, document checks, transaction import |

## Channels

1. **Staff** — username/password → access + refresh JWT → dashboard / Swagger.
2. **Bank systems (P1)** — API key or client-credentials token scoped to `/api/integration/**`.

## How staff auth works

1. `POST /api/auth/login` → BCrypt check against `users.password_hash`.
2. Short-lived access JWT + hashed refresh token in `refresh_tokens`.
3. `Authorization: Bearer …` on subsequent calls; `JwtAuthFilter` sets SecurityContext.
4. `POST /api/auth/refresh` rotates access tokens.

Public: `/api/auth/**`, Swagger, `/actuator/health`.

## What’s in this package (Day 2)

| Piece | Role |
|-------|------|
| `User`, `Role`, `RefreshToken` | JPA entities |
| Repositories | Persistence |
| `SecurityConfig`, `Jwt*` | Filter chain + tokens |
| `AuthController` / `AuthService` | Login + refresh |
| `DataSeeder` | `admin` / `compliance` / `analyst` (`ChangeMe123!`) |

## Related

Used by every protected module. Service-account auth lands in P1 with integration routes.
