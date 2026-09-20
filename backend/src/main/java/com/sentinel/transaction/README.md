# Transactions module

**Owns:** real-time payment scoring and history.

## What’s here now

- `POST /api/integration/transactions/score` (primary) and staff desk score
- Idempotent on `externalTransactionId` per tenant
- Persists anomaly, rule flags, SHAP-shaped features, recommendation
- Flagged TX opens a case; customer risk refreshed

Stub ML forces higher anomaly on large amounts / `velocity` external ids.
