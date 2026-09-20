# Customer / KYC module

**Owns:** the bank’s client record and KYC session lifecycle.  
**Requirements:** FR-5–8, FR-28, FR-30–33.

## Flows

### Bank API path
1. Bank starts `POST /api/integration/kyc/sessions` with `externalCustomerId` (+ optional `returnUrl`).
2. Response includes `challengeId`, `publicToken`, and `hostedUrl`.
3. Bank may submit media itself **or** redirect the customer to `hostedUrl`.

### Hosted KYC UI (third-party page)
1. Customer opens `/kyc/{publicToken}` (no Sentinel login, no API key).
2. Captures ID + selfie / liveness challenge.
3. `POST /api/kyc/hosted/{token}/submit` → same scoring + customer upsert as bank submit.
4. Optional `returnUrl` sends the customer back to the bank channel.

## What’s here now

Entities: `Customer`, `KycSession` (token + TTL). Services: `KycService`, `CustomerService`. Controllers: integration, hosted public, staff 360°.
