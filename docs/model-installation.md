# Add the trained KYC models after building

The applications build and run without identity weights. KYC remains pending or
unavailable until all four evaluated artifacts load. No application rebuild is
needed merely to change the configured artifact directory; restart the identity
service after installing a new version. Hosted Docker Spaces need a rebuild when
their bundled artifacts change.

From the Sentinel repository root:

```powershell
python scripts/import_identity_artifacts.py --archive C:/path/to/kyc-models.zip --output services/cv-ml/artifacts/identity-release-001
```

The importer accepts either `face/...` or `identity/face/...` ZIP layout, with
the equivalent folders for `liveness`, `tampering` and `ocr`. Each folder needs
`weights.pt` and the canonical `evaluation.json`. It validates the actual model
architecture, finite weights, checksums, preprocessing version, detector checksum
and unchanged validation/test gates before installing anything. It never replaces
an existing artifact directory. Missing, corrupted and research-only artifacts
are rejected. Only import ZIPs from training runs you trust.

The simple CelebA notebook produces face **pretraining** weights with a research
report. Those can initialise a representative document/selfie training run, but
cannot substitute for all four deployment artifacts. Do not rename or fabricate
evaluation reports.

Run the identity service with the installed directory:

```powershell
cd services/cv-ml
$env:CV_ML_ARTIFACT_DIR = (Resolve-Path artifacts/identity-release-001).Path
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Check `/health`: `verificationReady` must be true and all four model flags must
be true. In hosted environments configure the same `ML_SERVICE_API_KEY` on the
identity service and Sentinel API. Exercise an actual document/video verification
and rejection/attack scenarios before accepting live identity decisions.

For Hugging Face, re-export the identity Space with validated weights:

```powershell
python scripts/prepare_hf_space.py --service cv-ml --artifacts services/cv-ml/artifacts/identity-release-001 --output ../hf-identity-release-001
```

Upload that directory to the identity Space. The same Java API and Sutura clients
continue using its configured URL. Dataset acceptance, real provider credentials,
public URLs and live end-to-end checks remain separate from compilation.
