# Automatic KYC

The recording endpoint implements automatic approval or rejection. An unavailable
model (or a missing report under the evaluated policy) returns HTTP 503 with code
`KYC_AUTOMATION_UNAVAILABLE`; it does not consume the challenge, cache a rejection,
or send the customer for manual approval. The original challenge expiry still
applies. Start a new session after expiry or a Space restart.

The installed pretrained components are YuNet/SFace for document-to-video face
comparison, two MiniFASNet models for passive presentation-attack detection,
PP-OCRv4 for document text, and PSCC-Net for image-manipulation classification.
The server also checks a continuous recording, face continuity and the issued
head-turn sequence. No training from scratch is necessary to run these models.

PSCC-Net is a general image-manipulation detector, not an issuer database, a
forensic guarantee, or a locally validated identity-document authenticity model.
OCR, MRZ checks and a low tampering score cannot establish that an issuer created
an ID. Its original MIT source and notices are included in `app/models/pscc/`.
Weights are pinned to upstream revision
`53e5ff77d8dc5feddda060cd085f9b765761f816` in
`app/models/assets/pscc-manifest.json`. Only the HRNet backbone and classification
head are used; this integration makes no manipulation-localisation claim.

## Approval policy

`CV_KYC_REQUIRE_EVALUATION=true` is the default and requires accepted local
holdout reports. Set `CV_KYC_REQUIRE_EVALUATION=false` to use the complete pinned
pretrained pipeline without those reports. This is the selected hosted policy.
Initial thresholds are SFace cosine 0.363, MiniFASNet real score 0.9 and PSCC
tampering score 0.5; valid installed reports may supply calibrated thresholds
instead. Tenant risk thresholds still apply separately.

All models must load with valid checksums and no runtime/acceptance-file errors.
Real face comparison, anti-spoof inference, the recording challenge, readable
unexpired document fields and tampering checks still run. Custom trained
artifacts retain their existing evaluation gates. No synthetic scores or
automatic successes are substituted.

Health and inference expose `approvalPolicy=pretrained-thresholds`,
`evaluationRequired=false`, `localAccuracyValidated=false` and
`evaluationWarnings` until independent reports establish local accuracy.
Underlying `*Evaluated` flags remain false; reports are never invented. Missing
evaluation reports become warnings under this policy, not rejection reasons.

## Installation

From `services/cv-ml` in PowerShell:

```powershell
python -m pip install -r requirements.txt
python -m app.models.install_pretrained --output artifacts/pretrained
python -m app.models.install_pretrained --component tampering --output artifacts/pscc
$env:CV_PRETRAINED_DIR = (Resolve-Path artifacts/pretrained).Path
$env:CV_TAMPERING_DIR = (Resolve-Path artifacts/pscc).Path
$env:CV_DOCUMENT_OCR = 'true'
$env:CV_KYC_REQUIRE_EVALUATION = 'false'
# Set the existing ML_SERVICE_API_KEY locally; never commit it.
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001
```

CPU PSCC input is RGB divided by 255, downscaled proportionally to a maximum
1024-pixel long edge, then white-padded to multiples of 32 (minimum 64). No
ImageNet normalization is applied. This bounded wrapper preprocessing is part of
the acceptance identity and must be evaluated, rather than borrowing paper metrics.

## Decision contract

`GET /health` distinguishes loaded models from accepted models and provides
`automaticApprovalReady` and `readinessBlockers`. It never enables verification
merely because weights loaded under the default evaluated policy. The explicitly
selected pretrained-threshold policy allows loaded models without local reports.

`POST /cv/kyc-verify-recording` uses the existing request schema. With accepted
models it returns `verificationDecision` (`APPROVED` or `REJECTED`),
`automaticApproval`, and `decisionReasons`, alongside existing evidence hashes and
scores. Approval requires a server-verified recording challenge, at least 25
compared faces, face and liveness thresholds, no suspected spoof, accepted
document checks, a readable ID number and DOB, and a valid unexpired expiry date.
Any adverse signal prevents approval. Requests cannot supply a successful
challenge flag themselves. Unavailable or invalid models produce 503 instead.

The Java gateway enforces the explicit decision and existing evidence binding.
The tenant's risk settings remain an additional approval requirement; borderline
hosted KYC results are automatically rejected rather than awaiting review.
SFace cosine similarity remains cosine similarity, not an invented probability.
Tenant thresholds must be calibrated against the same representative evidence.
Audit/security cases may still be recorded; they do not grant automatic approval.

`POST /cv/document-verify` runs OCR and manipulation detection independently.
Its `verificationDecision` describes the document checks only; it never verifies
a person's identity. `manualReviewRequired` is false. Unsupported specialist
document/signature checks cannot be approved through the ID pipeline.

## Optional local evaluation

Local evaluation can be added later without retraining. Set
`CV_KYC_REQUIRE_EVALUATION=true` to require it for approval. Independent reports bind hashes, preprocessing and
thresholds. Face/liveness and OCR evaluation are described in
[pretrained-kyc.md](pretrained-kyc.md). For PSCC, keep consented labelled documents
private and create `data/private/tampering.jsonl`, with paths relative to it:

```json
{"scope":"identity-documents","split":"validation","subjects":["source-person-a"],"document":"documents/a-genuine.jpg","label":0}
{"scope":"identity-documents","split":"test","subjects":["source-person-b"],"document":"documents/b-tampered.jpg","label":1}
```

Label 0 means genuine, 1 means tampered. These two example rows only illustrate
the schema. Each split needs at least 100 genuine and 100 tampered documents.
Include all person/source-document identities in `subjects`; keep validation and
test sources disjoint. Duplicate file content is rejected. Choose the threshold
on separate development data before running the held-out test.

```powershell
python -m app.models.evaluate_tampering --dataset data/private/tampering.jsonl --models artifacts/pscc --threshold 0.5
```

The evaluator runs actual inference and writes `evaluation-candidate.json`. Only
reports meeting the existing gates (99% tampering sensitivity, 90% specificity on
both splits) install `acceptance.json`. The evaluated policy remains unavailable
without passing reports. Invalid installed reports are errors under either policy.
Public face benchmarks, generated text images and successful contract tests do
not substitute for these measurements. The deployed service has real inference
but currently lacks representative evidence of accuracy for Sutura customers.

## Hugging Face export

From the Sentinel repository root, export into a new local folder:

```powershell
python scripts/prepare_kyc_space.py --sdk gradio --tampering services/cv-ml/artifacts/pscc --output ../.local-validation/kyc-space-export
```

This includes pinned weights and optional acceptance reports, excluding private
datasets and environment files. Configure `ML_SERVICE_API_KEY` as a Space secret
and use the same key on Sentinel. Free ZeroGPU queues, quotas, cold starts and
ephemeral challenge storage remain deployment limitations.
