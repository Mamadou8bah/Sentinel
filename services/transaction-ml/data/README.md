# Transaction datasets

Place the original PaySim CSV here as `paysim.csv`.
Keep the original header; training uses `step`, `amount`, `type`, and `isFraud`.
Dataset files in this directory are excluded from Git and Docker images.

From the service directory:

```powershell
python -m app.training.train --paysim data/paysim.csv --output artifacts/paysim-v2
```

Training writes model weights and evaluation metrics to `artifacts/paysim-v2/`.
The source dataset is never modified. Do not put identity evidence here.

The version 3 comparison command also requires the original `oldbalanceOrg`
column. Keep the complete original CSV; post-transaction balance columns and
account identifiers are never used by these pipelines.
