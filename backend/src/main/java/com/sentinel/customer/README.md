# Customer / KYC module

**Owns:** the bank’s **client** record being verified, and their KYC state.  
**Requirements:** FR-5–8, FR-28, FR-30.

## What this module is

A **`Customer` is not a Sentinel login.** It is the person (or account holder) the bank is onboarding or reviewing. Documents, transactions, and cases hang off this record. Staff or **bank systems** submit evidence; CV/ML fills face match, liveness, and related scores.

## Bank workflow

1. Client applies at the bank (branch or bank app at home).
2. Staff desk **or** bank integration API starts KYC → `Customer` with `kycStatus = PENDING`.
3. Liveness **challenge** (anti-spoof) + ID image submitted; media stored by reference.
4. **Integration** calls CV (`/cv/liveness/*`, `/cv/kyc-verify`) asynchronously.
5. Scores persisted; **fail-closed**: spoof / poor quality → `FLAGGED` or stay `PENDING`, never silent `VERIFIED`.
6. **Risk** updates `riskScore`; may open a **Case**.
7. Bank continues account opening from VERIFIED / compliance decision; webhook notifies bank core (P1).

## Data model

| Field | Meaning |
|-------|---------|
| `name`, `dob`, `idNumber` | Identity (`idNumber` encrypted at rest — NFR-5) |
| `kycStatus` | `PENDING` → `VERIFIED` / `FLAGGED` / `REJECTED` |
| `faceMatchScore`, `livenessScore` | 0–1 from CV (liveness = anti-spoof) |
| `riskScore` | 0–100 overall |
| `externalCustomerId` | Bank-core reference (P1) |

## What’s here now

- `Customer` entity + `CustomerRepository` + `KycStatus`

Controllers, challenge flow, encryption, and async pipeline follow the P0 roadmap.

## Related modules

**document**, **transaction**, **risk**, **casemanagement**, **integration**, **auth** (who may submit).
