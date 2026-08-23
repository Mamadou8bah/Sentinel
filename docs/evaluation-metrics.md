# Evaluation metrics

Credibility for examiners/interviewers — track during training and final demo.

## Signature verification (CEDAR test split)

- Precision, Recall, F1
- ROC-AUC
- Threshold used in production path (e.g. 0.85) and confusion matrix at that threshold

## OCR

- Field-level extraction accuracy (name, DOB, ID number, amount, date, payee, account)
- Character Error Rate (optional) on synthetic IDs/cheques

## Liveness / anti-spoof

- Attack presentation classification: live vs print / screen / replay
- False accept rate (spoof passes) and false reject rate (live fails) at operating threshold
- Challenge completion rate / quality rejection rate (fail-closed path)

## Transaction fraud / anomaly (PaySim labeled fraud)

- Precision / Recall / F1 / ROC-AUC against labeled fraud flag
- False positive rate (critical for compliance UX)
- Calibration of `anomalyScore` vs operating `ALLOW` / `REVIEW` / `BLOCK` thresholds
- **SHAP sanity:** top features stable under small input noise; explanations reviewed on a held-out case set (not just accuracy)

## System / platform

| Metric | Target / note |
|--------|----------------|
| Sync API latency | p50 / p95; NFR-1 aspirational &lt; 300ms for auth/CRUD |
| E2E pipeline | Upload → risk score ready (async path), p50/p95 |
| WebSocket | Time from case creation to UI receipt |

## Where to store results (later)

- `docs/metrics/` reports (markdown/PDF excerpts for thesis)
- Model artifacts stay local under `services/*/app/models/` (gitignored binaries)
