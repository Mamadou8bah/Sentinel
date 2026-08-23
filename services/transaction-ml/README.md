# Transaction ML microservice

**Runtime:** Python 3.11 · FastAPI · scikit-learn · XGBoost/LightGBM · **SHAP**  
**Port:** 8002  
**Contract:** `docs/ml-contracts.md` · `docs/contracts/transaction-ml.openapi.yaml`

## Endpoints

| Path | Responsibility |
|------|----------------|
| `POST /ml/transaction-score` | Rules + model score + SHAP top features |
| `GET /health` | Service health |

## Packages

```
app/
  api/         route handlers
  rules/       amount outlier, velocity, channel/geo sanity
  features/    customer history aggregates passed from Spring
  models/      XGBoost / LightGBM (and optional Isolation Forest)
  explain/     SHAP TreeExplainer (or KernelExplainer fallback)
  artifacts/   trained weights (gitignored)
```

## Product bar

Not a single opaque score. Pipeline:

1. **Rules** — deterministic flags (auditable, low latency)  
2. **Model** — supervised/anomaly model trained & evaluated on PaySim; bank-shaped features at ingest  
3. **SHAP** — per-TX feature contributions for officers and the bank API  
4. Spring risk engine — tenant thresholds → `ALLOW` / `REVIEW` / `BLOCK`

## Implementation order

1. FastAPI skeleton + health  
2. Rule engine  
3. Train boosted model on PaySim; persist artifact  
4. Wire SHAP explanations into score response  
5. Integrate with Spring real-time `/transactions/score`
