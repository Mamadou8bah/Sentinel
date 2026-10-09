# Transaction datasets

Place the original PaySim CSV here as `paysim.csv`.
Keep the original header; training uses `step`, `amount`, and `isFraud`.
Dataset files in this directory are excluded from Git and Docker images.

From the service directory:

```powershell
python -m app.training.train --paysim data/paysim.csv --output artifacts/paysim
```

Training writes model weights and evaluation metrics to `artifacts/paysim/`.
The source dataset is never modified. Do not put identity evidence here.
