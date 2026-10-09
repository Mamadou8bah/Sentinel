# Transaction scoring service

FastAPI service on port 8002. Run commands from this directory:

```powershell
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8002
python -m pytest -q
```

`GET /health` reports the mode and model readiness. `POST /ml/transaction-score`
accepts the Java gateway contract; interactive request schemas are at `/docs`.
Rules mode is the default and returns explicit rule explanations with
`modelRan=false`; it never fabricates SHAP attributions.

## Train and serve a baseline

```powershell
python -m app.training.train --synthetic --rows 20000 --seed 42 --output artifacts/local
$env:TRANSACTION_ML_MODE='trained'
$env:TRANSACTION_ML_MODEL_PATH='artifacts/local/model.joblib'
python -m uvicorn app.main:app --host 127.0.0.1 --port 8002
```

Put PaySim at `data/paysim.csv`, then train it separately from the synthetic baseline:

```powershell
python -m app.training.train --paysim data/paysim.csv --output artifacts/paysim
```

Required columns are `step`, `amount`, and `isFraud`.
Synthetic data is clearly labelled and is not PaySim. The chronological split
uses the first 80% of steps for training and the final 20% for evaluation.
The amount/time GradientBoostingClassifier uses `log_amount`, `hour_sin`, and
`hour_cos`; no post-outcome fields enter its feature vector.

Training writes `model.joblib` and `evaluation.json`, with dataset hash, seed,
package versions, parameters, precision, recall, false-positive rate, average
precision, and confusion matrix. Trained mode computes actual TreeExplainer
SHAP values in log-odds space. Missing or incompatible trained artifacts cause
health/scoring failures instead of a silent fallback. Joblib artifacts must be
trusted local build outputs; never load customer-supplied artifacts.

The initial synthetic baseline has low recall and is an integration example,
not evidence of real payment fraud detection. Rules and model evaluation remain
separate. Model scores are uncalibrated; tenant thresholds need evaluation.
Docker Compose can run the explicit rules service with `--profile inference`.

## Directory layout

```text
app/
  main.py      Application setup; uvicorn entry point
  api/         HTTP routes and request schemas
  services/    Scoring or image-evidence logic
  training/    Dataset loading, model training and evaluation CLI
tests/         Service tests
data/          Local datasets; ignored except README
artifacts/     Generated models/evaluations; ignored except README
```

Run service, training and test commands from this service directory.
