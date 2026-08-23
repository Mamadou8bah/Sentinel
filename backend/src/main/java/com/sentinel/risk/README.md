# Risk scoring engine

**Owns:** policy that turns KYC + document + transaction signals into one 0–100 score and an explanation.  
**Requirements:** FR-17–20, FR-30 (fail-closed).

## What this module is

ML returns sub-scores. The risk engine applies **bank-configurable** weights/thresholds from `RiskSettings`, builds explanations, and decides auto-flag. Spoof / failed liveness / poor quality must **not** produce a silent VERIFIED path.

## Default settings (seeded)

| Setting | Default | Role |
|---------|---------|------|
| `kycWeight` | 0.35 | Weight of KYC signals |
| `documentWeight` | 0.40 | Weight of document fraud |
| `transactionWeight` | 0.25 | Weight of TX anomalies |
| `signatureMatchThreshold` | 0.85 | Below → concern |
| `faceMatchThreshold` | 0.80 | Below → concern |
| `tamperingThreshold` | 0.50 | Above → concern |
| `anomalyThreshold` | 0.70 | Above → flag TX |
| `autoFlagRiskScore` | 60 | Overall ≥ → open Case |

## Flow

1. New evidence arrives (including liveness/spoof flags).
2. Load `RiskSettings` → recalculate score + explanation.
3. Fail-closed KYC policy applied before VERIFIED.
4. Auto-create **Case** when flagged; Admin weight changes → **audit**.

## What’s here now

`RiskSettings` + repository + `DataSeeder` (per tenant). Scoring service in P0.
