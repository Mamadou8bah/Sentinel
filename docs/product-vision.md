# Product vision — Sentinel for banks

Sentinel is a **multi-tenant bank compliance platform**: KYC, document fraud detection, **real-time transaction risk**, explainable scoring, case review, and immutable audit. Banks integrate it; retail clients use **bank apps**, not a Sentinel signup.

## Who is who

| Term | Meaning |
|------|---------|
| **Tenant / bank** | Institution on the platform; data and settings isolated per bank. |
| **Staff `User`** | Bank employee: `ADMIN`, `COMPLIANCE`, `ANALYST` (staff JWT). |
| **Bank system** | Bank app backend / core / payment switch calling Sentinel with a **service credential**. |
| **`Customer`** | Bank’s client being verified/monitored. Never a Sentinel login. |
| **Reference signature** | Enrolled specimen for that customer (required before signature *match*). |

## What Sentinel is / is not

| Is | Is not |
|----|--------|
| KYC / fraud **engine** + **compliance ops desk** | Core banking or the payment rail itself |
| Per-transaction risk API the bank calls before/as it posts a payment | Only overnight batch CSV scoring |
| Signature verify **against an enrolled specimen** | Magically knowing a signature is “wrong” with no prior sample |

## KYC workflow

```
Client (bank app or branch) → bank backend / staff
  → Sentinel KYC session (tenant + externalCustomerId)
  → ID + liveness challenge → CV/ML
  → fail-closed status + risk score
  → enroll reference signature when available (ID strip / wet-ink / card)
  → VERIFIED or Case → webhook + staff desk
```

## Document fraud workflow (not oversimplified)

Checks are **separate**; each needs the right prior data:

| Check | Needs beforehand? | What it detects |
|-------|-------------------|-----------------|
| **Image tampering** | No | Digital edit / splice / resave artifacts on *this* image |
| **OCR + field sanity** | Customer profile helpful | Amount vs words, date oddities, payee ≠ customer name |
| **Signature match** | **Yes — reference signature on file** | Ink on cheque vs enrolled specimen |
| **Account / MICR consistency** | Bank account data on customer | Wrong account number on instrument |

**Enrollment (required for match):** during/after KYC or at branch, store a `referenceSignature` (and optional later specimens) on the customer.  
**Verify:** bank/staff submits cheque/invoice → CV runs tampering + OCR + (if specimen exists) signature match → risk / case.  
If **no specimen** yet: still run tampering + OCR; signature match is `SKIPPED` / fail-closed for high-value instruments — do not pretend a match score.

## Transaction workflow (real-time first)

```
Bank payment switch / core is about to post a transaction
  → POST Sentinel score API (tenant, customer, amount, time, channel, counterparty, …)
  → rules + gradient-boosted / anomaly model vs customer history
  → SHAP feature contributions for explainability
  → response: anomalyScore, ruleFlags, shapTopFeatures, ALLOW | REVIEW | BLOCK
  → bank decides; Sentinel stores TX + may open Case / notify compliance
```

Bulk CSV import remains for **backfill / training / migration**, not the primary production path.

## Dual channels

1. **Ops desk** — staff JWT, cases, 360°, analytics.  
2. **Bank integration** — service credentials: KYC sessions, document verify, **per-TX score**, webhooks.

## Success definition

Banks pilot Sentinel multi-tenant: onboard clients, enroll specimens, score documents honestly, score **each** transaction in-line, review cases with audit — pilot-grade engineering; certification is a separate process.
