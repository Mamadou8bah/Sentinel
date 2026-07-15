# PaySim

Download the PaySim synthetic mobile-money dataset (Kaggle / academic release) into this folder.

Suggested layout after download:

```
datasets/paysim/
  raw/
  processed/   # filtered columns for Isolation Forest
```

Used by: `services/transaction-ml` rules + Isolation Forest.

Keep only this README in git — raw CSV is large and gitignored.
