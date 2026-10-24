# ML hosting and identity training

The generated transaction image uses Python 3.12 and pins the locally validated NumPy/scikit-learn/joblib/SHAP versions when exporting artifacts. This avoids silently changing the pickle/explanation runtime. Local exported-app loading was checked; the hosted Docker build still needs acceptance.

Prepared 24 October 2026. Hosting does not train a model.

## Hugging Face Spaces

Check the account's Create Space options first. Current HF documentation says
Docker/Gradio compute Spaces require an eligible paid account, even though CPU
Basic has no hourly compute charge. Do not assume an ordinary free account can
create these services. See https://huggingface.co/docs/hub/spaces-overview.

From the Sentinel repository root, export two NEW directories outside the repo:

```powershell
python scripts/prepare_hf_space.py --service transaction-ml --artifacts services/transaction-ml/artifacts/paysim-v3 --output ../hf-transaction
python scripts/prepare_hf_space.py --service cv-ml --output ../hf-identity
```

Create two Docker Spaces and upload the corresponding directory contents. The
export includes service code and selected artifacts only, never `.env`, datasets,
runtime databases or training logs. Do not use the browser Upload folder action
on the entire project. Only upload artifacts you trained or trust: joblib model
loading is not a safe format for untrusted third-party files.

Add `ML_SERVICE_API_KEY` as a **Secret**, at least 32 random characters, in both
Spaces and the Sentinel Java API. Set `CV_ML_BASE_URL` and
`TRANSACTION_ML_BASE_URL` on Java to the respective HTTPS `*.hf.space` origins.
Use a public/protected Space with this application-level authentication; private
Spaces additionally require HF platform authentication, which this adapter does
not add. Keep keys out of VITE/EXPO/NEXT_PUBLIC variables.

The generated Dockerfile listens on port 7860. `/health` is public; inference
requires `X-ML-API-Key`. HF hosting refuses to process unauthenticated inference
when its Space secret is missing/too short. Cold starts can exceed caller
timeouts: open and check both health URLs before a presentation. Never retry
unknown payment outcomes as new operations.

The transaction export uses `trained` mode when artifacts are included. The
local PaySim-v3 bundle loads successfully; its known data/false-positive limits
remain in the evaluation report. It is not independent live-payment acceptance.

The identity export deliberately includes no trained weights. Health reports
`verificationReady=false`. After all four tasks pass evaluation, export again
with `--artifacts services/cv-ml/artifacts/identity`. A Space's local challenge
SQLite database is ephemeral. A restart invalidates active sessions; request a
new verification link. Durable production evidence/challenge storage is still
required beyond this presentation setup.

## Identity training

Run from `services/cv-ml`:

```powershell
python -m app.training.run_all --data data --check-only
python -m app.training.run_all --data data --output artifacts/identity-run-1 --epochs 20 --device cpu
```

The first command identifies missing manifests, split leakage and insufficient
holdouts before any training starts. Supply `face.jsonl`, `liveness.jsonl`,
`tampering.jsonl`, `ocr.jsonl` and referenced images in the documented formats.
The second command trains each task and checks artifact acceptance. Failed
holdout gates leave verification unavailable. Use a new output directory to
preserve previous artifacts. CUDA is optional if a compatible GPU is available.

No identity samples were present locally on 24 October; no real identity training
has been performed. Automated fixture training only validates code execution.

## Dataset acquisition

- MIDV-2020: https://l3i-share.univ-lr.fr/MIDV2020/midv2020.html . Mock identity
  documents and annotations can support document OCR experiments. Access requires
  the publisher's form/license process; the complete dataset is about 124 GB.
  It does not supply real document-to-selfie identity pairs or face challenge
  recordings. Do not treat its generated portraits as live people.
- CelebA-Spoof: https://mmlab.ie.cuhk.edu.hk/projects/CelebA/CelebA_Spoof.html .
  Anti-spoof still images are available for non-commercial research under the
  publisher's agreement. They do not replace ordered continuous head-turn
  recordings, and cannot alone validate this liveness sequence model.
- FMIDV: https://l3i-share.univ-lr.fr/2022FMIDV/0_Archive/2022FMIDV.html . Forged
  mock-document samples for tampering research; requires requesting access.

Keep publisher source splits and subject/source separation. Do not manufacture
three-frame sequences by repeating a still or assign arbitrary pose labels.
Real consented document/selfie pairs and live/spoof challenge recordings are
still needed for representative end-to-end acceptance. Public research data is
an experiment starting point, not evidence of production verification accuracy.
