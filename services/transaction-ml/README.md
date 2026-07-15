# Transaction ML microservice (scaffold)

**Runtime:** Python 3.11 · FastAPI · scikit-learn  
**Port:** 8002  
**Contract:** `docs/ml-contracts.md` · `docs/contracts/transaction-ml.openapi.yaml`

## Planned endpoints

| Path | Responsibility |
|------|----------------|
| `POST /ml/transaction-score` | Rule flags + Isolation Forest anomaly scores |
| `GET /health` | Liveness |

## Planned packages

```
app/
  api/        route handlers
  rules/      amount outlier, high frequency, unusual location
  anomaly/    Isolation Forest trained on PaySim
```

## Scope note

Keep simple: rules + one Isolation Forest — expected for FYP; do not over-engineer with deep learning.

## Next implementation step (week 8)

1. FastAPI skeleton
2. Rule engine
3. Train Isolation Forest on PaySim subset; persist `.joblib`
4. Integrate with Spring CSV import flow
