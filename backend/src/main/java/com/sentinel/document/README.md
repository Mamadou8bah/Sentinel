# Document fraud module

**Owns:** financial document evidence for a bank **Customer**, plus fraud sub-scores.  
**Requirements:** FR-9–12.

## Reality check

Sentinel cannot “know” a signature is forged without a **reference specimen** on file. Product behavior:

| Signal | Prerequisite | Behavior without prerequisite |
|--------|--------------|-------------------------------|
| Tampering score | None (this image only) | Always runnable |
| OCR / field checks | Document image; customer profile optional | Always runnable; richer if profile exists |
| Signature match | Enrolled `referenceSignature` (or specimen set) | `signatureMatchStatus = SKIPPED`; high-value → case / fail-closed policy |

## Enrollment

1. Capture specimen at KYC (ID signature strip), branch wet-ink, or signature card upload.  
2. Store on customer (object storage ref + metadata).  
3. Optional: multiple specimens over time (updates audited).

## Verify flow

1. Staff or bank system uploads cheque/invoice linked to `Customer`.  
2. Load specimen if present; call CV `document-verify` (image + optional reference).  
3. Persist OCR JSON, `tamperingScore`, `signatureMatchScore` (or SKIPPED), composite fraud score.  
4. Risk engine recalculates; threshold breach → **Case**.

## What’s here now

`Document`, enums, repository. Specimen enrollment fields/API and verify pipeline in P0.
