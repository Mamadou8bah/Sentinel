# Risk engine

**Owns:** tenant thresholds/weights and how scores become KYC status, TX recommendations, and case opens.

## What’s here now

- `RiskSettings` per tenant (seeded + admin GET/PUT)
- `RiskEngine` — KYC status, customer 0–100 risk, `ALLOW`/`REVIEW`/`BLOCK`, explanations

Cases open when risk ≥ `autoFlagRiskScore` or KYC/document/TX policy flags fire.
