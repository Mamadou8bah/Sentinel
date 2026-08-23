# Transaction monitoring module

**Owns:** per-payment risk answers for the bank, plus stored TX history for 360° / ML features.  
**Requirements:** FR-13–16.

## Primary product path: score at transaction time

When the bank is making/posting a payment, **it calls Sentinel**; we return the risk associated with that transaction so the bank can allow, step-up, or block.

```
Bank core / switch
  → POST /api/integration/transactions/score  (service auth)
  → rules + model (+ SHAP from TX-ML) vs customer history
  → { anomalyScore, flagged, ruleFlags, shapTopFeatures, recommendation, customerRiskScore }
  → bank acts; Sentinel persists TransactionEntity; may open Case
```

Latency target: near real-time for the score call (sync path); case fan-out can be async.

## Secondary path: bulk import

`POST /api/transactions/import` — historical backfill, model eval (PaySim), migrations. Not the main production control point.

## What’s here now

`TransactionEntity` + `TransactionRepository`. Real-time score API + ML wiring in P0/P1.
