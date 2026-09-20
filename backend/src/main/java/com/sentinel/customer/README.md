# Customer / KYC module

**Owns:** the bank’s client record and KYC session lifecycle.  
**Requirements:** FR-5–8.

## Flow

1. Bank starts `POST /api/integration/kyc/sessions` with `externalCustomerId`.
2. Bank submits ID + selfie images (base64).
3. Stub/ML scores → `Customer` upsert → KYC status via `RiskEngine`.
4. Flagged/rejected or high risk → case opened; audit written.
5. Specimen enroll (integration or staff) enables signature match on documents.

## What’s here now

Entities: `Customer`, `KycSession`. Services: `CustomerService`. Controllers: integration + staff 360°.
