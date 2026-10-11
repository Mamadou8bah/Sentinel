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

Required PaySim columns are `step`, `amount`, `type`, and `isFraud`.
Synthetic data is clearly labelled and is not PaySim. Version 2 uses the first
60% of distinct steps for training, next 20% for threshold selection and final
20% for testing. This is a split by time windows, not equal row counts.

The feature vector contains log amount, UTC cyclic hour and one-hot transaction
type (`CASH_IN`, `CASH_OUT`, `DEBIT`, `PAYMENT`, `TRANSFER`, `UNKNOWN`). Inference
accepts optional `transactionType`; `DEPOSIT` and `WITHDRAWAL` map to `CASH_IN`
and `CASH_OUT`. Sutura now sends its operation separately from the transport
channel. Missing/unsupported context is shown in the explanation. PaySim type
semantics are simulated; validate their relevance to real Sutura operations.

No balance-after, fraud flags or account identifiers enter training. The deeper
120-tree model keeps all training positives and samples training negatives only
(default total target 500,000, retaining all positives even above the target).
Inverse sampling weights restore the original negative mass; positives have a
capped square-root imbalance weight. Validation/test rows are never resampled.
Vectorized feature construction reduces loading overhead.

`--max-fpr .005` selects maximum validation recall subject to a 0.5% false-positive
budget. `--max-train-rows 500000` changes training sampling. Failed validation
selection does not save an artifact. The budget does not guarantee test or live
performance. Reports show validation, test at the selected threshold and test at
0.5. Trained probabilities remain uncalibrated. `modelFlagged` records crossing
the selected review threshold; Sentinel upgrades an otherwise ALLOW decision to
REVIEW while keeping raw scores and tenant-driven BLOCK decisions unchanged.

Train separately to retain the original baseline:
```powershell
python -m app.training.train --paysim data/paysim.csv --output artifacts/paysim-v2 --max-fpr .005
```

Training writes `model.joblib` and `evaluation.json`, with dataset hash, seed,
package versions, parameters, precision, recall, false-positive rate, average
precision, and confusion matrix. Trained mode computes actual TreeExplainer
SHAP values in log-odds space. Version 1 amount/time artifacts remain loadable using their original feature contract.
Missing or incompatible trained artifacts cause
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

## Local PaySim comparison — 9 October 2026

The original and version 2 reports use the same final chronological test window
(123,572 rows; 1,646 fraud), although version 2 reserves an earlier validation
window and changes the training policy. This previously evaluated test window is
not a new independent dataset. Version 2 was not tuned using its test results.

| Model | Threshold | Precision | Recall | False-positive rate | Average precision | Detected fraud |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Original amount/time | 0.5 | 91.00% | 5.53% | 0.0074% | 0.2693 | 91 / 1,646 |
| Amount/time/type v2 | 0.416313 | 59.25% | 45.32% | 0.4207% | 0.5126 | 746 / 1,646 |

Version 2 misses 900 fraud cases and flags 513 legitimate transactions. Its
validation FPR was 0.4679% under the requested 0.5% budget. These are model-only
results; amount/velocity rules can add alerts and require separate evaluation.
The increased recall comes with more false positives. Neither report certifies
production safety. Original weights remain in `artifacts/paysim`; new weights
are in `artifacts/paysim-v2`. To try the new model locally:

```powershell
$env:TRANSACTION_ML_MODE='trained'
$env:TRANSACTION_ML_MODEL_PATH='artifacts/paysim-v2/model.joblib'
python -m uvicorn app.main:app --host 127.0.0.1 --port 8002
```

Existing Sentinel PostgreSQL schemas need
`backend/db/migrations/002_transaction_type.sql` before deploying the API update.
Deploy the Sentinel optional-type contract before the updated Sutura caller.
No running inference service is switched automatically by training.

Implementation references: scikit-learn's
[ROC thresholds](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.roc_curve.html)
and [gradient boosting sample weights and iteration monitor](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.GradientBoostingClassifier.html).

## Compare pre-debit balance candidates (version 3)

```powershell
python -m app.training.improve --paysim data/paysim.csv --output artifacts/paysim-v3
```

The separate comparison command reads `oldbalanceOrg` in addition to version 2
columns. It excludes all balance-after fields, `isFlaggedFraud`, and account IDs.
Two fixed candidates are compared: 180-tree depth-4 gradient boosting and
250-iteration histogram boosting with 15 leaves. Both use the same training
sample and weights. Selection maximises validation recall within the FPR budget,
then precision and average precision; only the winner is evaluated on test.
Iteration progress appears in the terminal. Defaults are seed 42, FPR budget
0.005 and training target 300,000. Original model directories remain separate.

Version 3 adds log available balance, amount/balance ratio and an explicit
missing-balance indicator. Only debit operations use balance context. Inference
accepts optional `availableBalance`; zero is different from missing. Deposit/
CASH_IN recipient balances are always ignored because they do not describe the
PaySim debit origin. Ten percent training-only balance dropout exercises missing
context; this does not guarantee good results without context.

Sutura obtains a pre-debit snapshot from its ledger for transfer, withdrawal,
payment and debit operations. It forwards the snapshot separately from the
operation type. Sentinel persists the first assessment snapshot. A retry reuses
the existing decision even if the current balance has changed; immutable payment
details still must match. The snapshot is advisory context, not a funds hold:
existing wallet locks, balances and limits still govern the actual posting.

The report includes validation-only candidate results, the winner's test metrics,
a missing-balance stress test, a feasible-debit subgroup (`amount <= balance`),
and the union of model flags with the available amount rules. It excludes
unavailable customer-velocity rules from this combined result. Simulator
balance quirks can inflate accuracy, and the final test window has already been
used for earlier reports. Fresh independent data and real payment acceptance
remain necessary. Do not present this as independent or production validation.

Apply Sentinel migrations 002 and 003 before deploying the updated API, then
update Sutura and point inference at the new artifact if accepted. No running
service is changed automatically. Version 1 and 2 artifacts remain supported.

Reference: scikit-learn's [histogram gradient boosting](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.HistGradientBoostingClassifier.html).

### Version 3 local result — 9 October 2026

Gradient boosting won the fixed validation comparison: both candidates reached
100% validation recall, but gradient boosting had four false positives versus
83 for histogram boosting. On the **previously used** final PaySim window, the
selected model detected 1,645/1,646 fraud cases with one false positive: 99.94%
precision, 99.94% recall, 0.00082% FPR. The selected threshold is 0.978357.
The feasible-debit subgroup had 1,645 true positives, one missed fraud and zero
false positives. These extreme results depend on PaySim's pre-balance patterns;
independent real-payment evaluation is still required.

Missing-balance stress recall falls to **16.52%** at that same threshold. Do not
expect version 3 to outperform version 2 when source balance is unavailable.
The combined legacy amount-rule/model report flags **93,813 legitimate payments**
(76.94% FPR; precision 1.72%), despite 100% recall. The fixed amount cutoffs are
not a validated PaySim policy; PaySim amounts cannot establish suitable GMD risk
limits. Do not silently remove wallet limits or fraud controls based on this
benchmark. Currency-aware amount/velocity policies need representative payment
data and an acceptable review workload before activation.

To inspect the new model locally without changing existing inference:
```powershell
$env:TRANSACTION_ML_MODE='trained'
$env:TRANSACTION_ML_MODEL_PATH='artifacts/paysim-v3/model.joblib'
python -m uvicorn app.main:app --host 127.0.0.1 --port 18003
```
Send the actual `transactionType` and pre-debit `availableBalance`, not a made-up
balance, to exercise the new feature contract. The full report is local at
`artifacts/paysim-v3/evaluation.json`; progress is in `training-v3.log` if training
was redirected. Datasets, artifacts and logs are excluded from Git.
