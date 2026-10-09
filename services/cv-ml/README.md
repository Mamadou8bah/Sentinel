# Identity evidence service

FastAPI service on port 8001. Run commands from this directory:

```powershell
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
python -m pytest -q
```

Implemented endpoints:

- `GET /health`: service status and explicit model readiness.
- `POST /cv/liveness/challenge`: unpredictable, expiring challenge and capture instructions.
- `POST /cv/liveness/verify`: bounded image decoding, quality/duplicate checks and single-use challenge consumption.
- `POST /cv/kyc-verify`: document/selfie validation and challenge binding; same-evidence retries are allowed.

Interactive request schemas are available at `/docs`. PNG, JPEG and WebP
images are decoded with Pillow and bounded by encoded length, dimensions and
pixel count. Challenge state persists in SQLite at `runtime/challenges.sqlite3`;
set `CV_CHALLENGE_DB` to change it. Preserve this database across restarts.
The Compose inference profile mounts a persistent challenge volume.

## Train and load identity models

The service includes small supervised PyTorch baselines for face matching,
challenge-conditioned liveness, document tampering and structured OCR. No trained
identity weights are supplied. PaySim trains transaction scoring only; it cannot
train these identity tasks. Prepare labelled identity datasets as described in
[data/README.md](data/README.md), then run each task from this directory:

```powershell
python -m app.training.train --task face --manifest data/face.jsonl --output artifacts/identity/face
python -m app.training.train --task liveness --manifest data/liveness.jsonl --output artifacts/identity/liveness
python -m app.training.train --task tampering --manifest data/tampering.jsonl --output artifacts/identity/tampering
python -m app.training.train --task ocr --manifest data/ocr.jsonl --output artifacts/identity/ocr
$env:CV_ML_ARTIFACT_DIR = (Resolve-Path artifacts/identity).Path
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Training prints loading, split validation, batch/epoch loss, evaluation and
artifact progress. Options include `--epochs`, `--batch-size`, `--learning-rate`,
`--device cpu` (default) or `--device cuda`, and `--seed`. Each task writes
`weights.pt` and `evaluation.json`. Checkpoint selection and binary thresholds
use validation data; the test split is evaluated afterwards. Dataset and weight
hashes record provenance. Do not edit reports to bypass failed evaluation.

Loading checks task/schema, evaluation counts, thresholds, weight hashes and
finite parameters. Both validation and test require at least 100 examples per
class. Face/liveness require sensitivity >=90% and specificity >=99%; tampering
requires sensitivity >=99% and specificity >=90%. OCR requires at least 100
examples and >=95% exact matches in each holdout. These empirical gates are
minimum checks, not evidence of production safety or a promise that these small
networks will reach them. Evaluate unseen identities, document types, capture
devices, physical attacks and replay attacks before deployment.

`/health` exposes loaded tasks and `verificationReady`. Until all four evaluated
models load, KYC returns `modelRan=false` and cannot grant VERIFIED status. OCR
predicts the explicit fields `ID=...` and `DOB=YYYY-MM-DD`; it does not verify an
issuing authority. The liveness model requires exactly three captured frames in
the server-issued instruction order. Challenge evidence binds every frame,
expires and permits only identical-evidence retries. The planned independent
`/cv/document-verify` contract remains unimplemented.

## Directory layout

```text
app/
  main.py      Application setup; uvicorn entry point
  api/         HTTP routes and request schemas
  services/    Scoring or image-evidence logic
  storage/     Persistent liveness challenge storage
  models/      Networks, preprocessing and evaluation gates
  training/    Manifest validation and supervised training
tests/         Service tests
data/          Local datasets; ignored except README
runtime/       Local challenge database; ignored
artifacts/     Local evaluated weights and reports; ignored
```

Run service, training and test commands from this service directory.

## Compose inference

From the Sentinel root, `docker compose --profile inference up --build` mounts
both services' artifact folders read-only. After PaySim training, set
`TRANSACTION_ML_MODE=trained` before starting Compose to load
`services/transaction-ml/artifacts/paysim/model.joblib`. CV loads the four task
folders under `services/cv-ml/artifacts/identity`. Restart inference services
after replacing artifacts; health endpoints show the resulting mode/readiness.
Datasets are never mounted into inference containers. Docker execution still
needs validation on a machine with Docker installed.
