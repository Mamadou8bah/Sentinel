# Pretrained KYC

Live API: https://mamadoubah-sentinel-kyc.hf.space (free ZeroGPU).

The pretrained PSCC-Net document classifier and explicit automatic-decision
contract are described in [automatic-kyc.md](automatic-kyc.md). Configure
`CV_TAMPERING_DIR` to use it; no custom tampering training is required.
Deployment acceptance on 4 November 2026 confirmed protected inference routes,
authorised challenge creation, generated-document OCR, and actual CUDA execution
of both MiniFASNet models. These are infrastructure smoke checks, not identity
accuracy measurements. The selected hosted policy now sets
`CV_KYC_REQUIRE_EVALUATION=false`: loaded pretrained models can make automatic
decisions while `/health` truthfully reports `localAccuracyValidated=false`.
The hosting framework is not a public identity-upload demo.

Face models no longer require training from scratch. YuNet locates a single face,
SFace aligns its landmarks and compares the document portrait against every
sampled recording face. MiniVision MiniFASNetV2 and V1SE classify the original
recording frames at their trained 2.7x and 4x context crop scales. Both networks
use BGR, raw 0–255 tensors and real class index 1, matching upstream inference.
Their probabilities are averaged, and every sampled frame must pass. The existing
continuous nine-second recording, server-selected prompt order, head-turn checks,
challenge expiry, evidence binding and single-use/retry protections remain.

## Install and run (PowerShell)

From `sentinel/services/cv-ml`:

```powershell
python -m pip install -r requirements.txt
python -m app.models.install_pretrained --output artifacts/pretrained
python -m app.models.install_pretrained --component tampering --output artifacts/pscc
$env:CV_PRETRAINED_DIR = (Resolve-Path artifacts/pretrained).Path
$env:CV_DOCUMENT_OCR = 'true'
$env:CV_TAMPERING_DIR = (Resolve-Path artifacts/pscc).Path
$env:CV_KYC_REQUIRE_EVALUATION = 'false'
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001
```

Set the existing `ML_SERVICE_API_KEY` for authenticated inference. Use
`POST /cv/liveness/challenge`, then submit the ID image, continuous recording and
issued challenge ID to `POST /cv/kyc-verify-recording`, as existing clients do.
No new mobile build or API route is needed. The older three-frame endpoint cannot
replace continuous recording verification.

Local and Docker inference runs on CPU, with no CUDA or torchvision dependency. The PyTorch runtime
still adds memory beyond the roughly 42 MB of weights. Measure the deployed
service's memory and latency; model file size is not its total RAM requirement.

The installer downloads approximately 42 MB from pinned upstream revisions and
verifies SHA-256. Weights stay in the gitignored artifacts directory; they are
not automatically downloaded during API startup. SFace's model licence is
`app/models/assets/LICENSE-SFace.txt`. MiniVision's unmodified architecture source,
Apache-2.0 licence and source notice are in `app/models/minifasnet/`. Exact weight
URLs and hashes are in `app/models/assets/pretrained-manifest.json`.

## Evaluate without training

For online datasets which do not contain our recording challenges, use
[public component benchmarks](public-benchmarks.md). The LFW downloader and
separate passive-PAD/OCR evaluators produce diagnostic reports without turning
them into full-KYC acceptance evidence.

Loaded weights allow real inference, but do not automatically grant VERIFIED.
The service reports loaded and evaluated status separately. Face matching,
anti-spoof detection and head-turn checks do not authenticate an identity document.
OCR and document tampering remain separate dependencies. Missing models or
acceptance reports under the default evaluated policy return HTTP 503 with `KYC_AUTOMATION_UNAVAILABLE`, leaving
the recording challenge unconsumed. They do not reject the customer's identity.

Collect consented genuine/mismatched identity pairs and genuine/photo/screen
attack recordings from the intended cameras and documents. Record them following
the supported prompt order. Never publish these samples. Use separate people for
validation and test; include every person appearing in a mismatched pair in
`subjectIds`. A private JSONL manifest uses paths relative to itself:

```json
{"split":"validation","subjectIds":["person-a"],"document":"ids/a.jpg","video":"recordings/a.mp4","instructions":["LOOK_FORWARD","TURN_LEFT","TURN_RIGHT"],"faceMatch":true,"live":true}
```

Each split needs at least 100 positives and 100 negatives **for each task**, with
at least 90% sensitivity and 99% specificity under the existing acceptance gates.
Use a separate development set to choose thresholds; do not tune on the test set.
Defaults are SFace cosine 0.363 and anti-spoof real score 0.9. These are initial
thresholds, not calibrated probabilities or claims of local accuracy. The SFace
score remains cosine similarity; Sentinel's own stricter policy thresholds still
apply. If face score calibration changes, evaluate the resulting policy too.

```powershell
python -m app.models.evaluate_pretrained --dataset data/private/holdout.jsonl --models artifacts/pretrained
```

This runs the actual recording pipeline, counts rejected captures as rejections,
rejects reused videos and cross-split subject overlap, and writes measured metrics.
Only passing reports become `acceptance.json`; failed candidates remain
`evaluation-candidate.json`. Reports bind model hashes and pipeline version.
Under the evaluated policy, full verification additionally requires accepted OCR evaluation and an evaluated
PSCC report in `CV_TAMPERING_DIR` (or a custom evaluated tampering artifact in
`CV_ML_ARTIFACT_DIR`). Face and OCR loading alone cannot
establish document authenticity.

## Document OCR and checks

`CV_DOCUMENT_OCR=true` enables offline PP-OCRv4 mobile detection, orientation and
recognition through RapidOCR 3.4.2 and CPU ONNX Runtime. The pinned wheel includes
the model files; the service verifies their checksums and passes explicit local
paths. It does not download models or fonts during requests. Runtime and model
licences are included in `app/models/assets/LICENSE-RapidOCR.txt`.

`POST /cv/document-verify` accepts `documentImage`, `docType` (`ID`, `CHEQUE` or
`INVOICE`) and an optional `referenceSignature`. Only ID field consistency is
implemented. Other types require specialist review; signatures have no supplied
model. Signature comparison is never silently marked as scored by Sentinel.

ID extraction uses explicit printed labels or two-line ICAO TD3 passport MRZs.
It validates MRZ check digits, printed/MRZ disagreement, conflicting fields,
birth dates and expiry. Ambiguous numeric dates are refused instead of guessing
the issuing country's convention. TD1/TD2 MRZ layouts and arbitrary ID templates
are not inferred. Missing expiry, unsupported layouts and unreadable fields
prevent automatic acceptance. These are consistency checks, not issuer validation
or a tamper detector. A counterfeit document can contain valid check digits.
References: [ICAO 9303 Part 3](https://www.icao.int/publications/documents/9303_p3_cons_en.pdf)
and [Part 4](https://www.icao.int/publications/Documents/9303_p4_cons_en.pdf).

Create a private OCR holdout JSONL manifest with distinct people and document
images in validation/test:

```json
{"split":"validation","subjectIds":["person-a"],"document":"ids/a.jpg","expectedFields":{"idNumber":"TEST123","dob":"1990-01-01","expiryDate":"2030-12-31"}}
```

```powershell
python -m app.models.evaluate_documents --dataset data/private/documents.jsonl --output artifacts/pretrained
```

At least 100 documents and 95% exact field matches are required in each split.
Only a passing report becomes `ocr-acceptance.json`. No supplied sample or unit
test is representative evaluation. Keep all identity data outside Git.

PSCC-Net now supplies real pretrained image-manipulation inference; installation,
document-specific evaluation and the automatic-decision contract are documented
in [automatic-kyc.md](automatic-kyc.md). The original custom artifact loader also
remains available. Under the evaluated policy, without accepted document evaluation, the document endpoint
returns real OCR/tampering diagnostics with `verificationDecision=UNAVAILABLE`,
`manualReviewRequired=false` and `documentChecksAccepted=false`. Recording KYC
returns HTTP 503. OCR success alone cannot establish authenticity.

## Hugging Face export

From the Sentinel repository root:

```powershell
python scripts/prepare_kyc_space.py --output ../.local-validation/hf-sentinel-kyc-release
```

For free eligible personal accounts, select ZeroGPU instead:

```powershell
python scripts/prepare_kyc_space.py --sdk gradio --output ../.local-validation/hf-sentinel-kyc-zerogpu
```

Hugging Face currently requires a paid plan for new Docker/CPU Basic Spaces.
Its free personal-account exception allows up to two eligible ZeroGPU Spaces.
See [HF ZeroGPU hosting](https://huggingface.co/docs/hub/spaces-zerogpu).
The Gradio SDK is used only for ZeroGPU lifecycle registration: the public root
returns API information, with no identity-upload demo interface. All inference
and Gradio routes require the shared service key; websocket connections are
disabled. MiniFASNet executes on CUDA inside a real ZeroGPU allocation. YuNet,
SFace and document OCR remain on CPU. GPU quota exhaustion returns an unavailable
error rather than bypassing checks. Quotas, queues and cold starts apply.

`POST /cv/runtime-check` is an authenticated diagnostic which runs both
anti-spoof networks on generated tensors and reports the actual device. It uses
a GPU allocation; ordinary `/health` checks do not. It is a deployment smoke
check, not an identity or liveness-accuracy evaluation.

The export copies only the CV application, verified face weights, licences and
existing acceptance reports. PP-OCRv4 weights install with the pinned dependency.
No datasets, environment files, logs, challenge database or credentials are
copied. Optional `--documents services/cv-ml/artifacts/identity` includes only
`tampering/weights.pt` and `tampering/evaluation.json`; runtime still validates
their independent acceptance gates.

Create a Gradio Space on free ZeroGPU (or a Docker Space with a suitable paid
plan), upload the exported directory, and set the
`ML_SERVICE_API_KEY` Space secret to the same key configured on Sentinel. The
export uses port 7860 and configures pretrained face models and document OCR.
Set its actual `https://<account>-<space>.hf.space` URL as `CV_ML_BASE_URL` on
Sentinel. Check public `/health`, unauthenticated inference rejection, authorised
document extraction and actual recording scenarios. Do not put the key in the
mobile apps. Set the Space variable `CV_KYC_REQUIRE_EVALUATION=false` to use the
pretrained-threshold policy, or keep the default evaluated policy.

For deployment, install weights into the image or copy the verified directory and
set `CV_PRETRAINED_DIR` to its absolute container path. Include the model licences
and architecture source. Persist the challenge database; ephemeral challenge
storage loses interrupted sessions on restarts. Do not log biometric images,
embeddings or recordings. No identity data is included in this implementation.

The service Dockerfile installs CPU-only PyTorch. To bundle pretrained weights,
build with `--build-arg INSTALL_PRETRAINED=true`, then configure
`CV_PRETRAINED_DIR=/app/artifacts/pretrained`. Downloading weights is an explicit
build step, never an API-startup dependency. Acceptance reports and evaluated
document artifacts must still be installed separately.
