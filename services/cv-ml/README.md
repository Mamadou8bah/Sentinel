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
- `POST /cv/kyc-verify-recording`: document portrait compared with every sampled face in a continuous recording, plus challenge-conditioned liveness, OCR and document tampering.
- `POST /cv/kyc-verify`: legacy still-image diagnostics; always returns `modelRan=false` and cannot grant verified status.

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
issuing authority. The recording pipeline extracts three settled face crops in the server-issued
instruction order for the liveness model. Every sampled face is separately
compared against the document portrait; the minimum match score is used.
Challenge evidence binds both document and recording hashes, expires and permits
only identical-evidence retries. Cached retries return the original result. The planned independent
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

## Continuous recording contract

The hosted page records nine seconds of video without audio: three seconds
looking forward, then three seconds for each randomly ordered left/right prompt.
It submits `idImage`, `videoBase64` and optional `name` to the hosted Java endpoint.
Java forwards the server-held `challengeId` to `/cv/kyc-verify-recording` and checks
the response pipeline version, challenge ID and recording SHA256 before trusting
inference. Still-image submissions cannot establish trusted KYC evidence.

Use base64 MP4 or WebM, at most 8 MB, 8–60 FPS, at most 1920x1080 and
8.5–11.5 seconds. The complete JSON request is limited to 16 MB in both services.
Decoding is bounded by frame count, dimensions and processing time. The service
samples approximately four frames per second, requires exactly one clear face
throughout, checks track continuity and held head poses, and rejects missing,
multiple, blurred or abruptly displaced faces. Pose geometry is a capture check;
it does not prove liveness. The evaluated anti-spoof model must also pass.
Original recordings are stored with session evidence by the Java storage service;
temporary decoder files are removed after processing. Apply the deployment's
access control and retention policy to its evidence volume.

Face localization uses the bundled, checksum-pinned OpenCV YuNet detector under
its accompanying MIT license in `app/models/assets/`. It detects portraits; it
provides no identity recognition weights. Training and inference use the same
`yunet-face-crops-v2` preprocessing. New artifacts use schema version 2 and record
the detector hash. Earlier artifacts are rejected and must be retrained. Face
and liveness manifests should reference original images containing one clear
face; preprocessing extracts crops automatically. OCR and tampering retain the
complete document image. Validate the full recording flow on representative
people, cameras and attack recordings before enabling live verification.
