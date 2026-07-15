# CV/ML microservice (scaffold)

**Runtime:** Python 3.11 · FastAPI  
**Port:** 8001  
**Contract:** `docs/ml-contracts.md` · `docs/contracts/cv-ml.openapi.yaml`

## Planned endpoints

| Path | Responsibility |
|------|----------------|
| `POST /cv/kyc-verify` | OCR ID fields, tampering, face match, simplified liveness |
| `POST /cv/document-verify` | OCR doc fields, Siamese signature (CEDAR), ELA tampering |
| `GET /health` | Liveness |

## Planned packages

```
app/
  api/           route handlers
  ocr/           Tesseract / EasyOCR / TrOCR
  signature/     Siamese CNN (PyTorch), CEDAR training scripts later
  tampering/     ELA + simple CNN classifier
  face/          Mediapipe / face_recognition
  models/        weight files (gitignored binaries)
```

## Tech choices (from PRD)

- OCR: Tesseract / EasyOCR / TrOCR
- Signature: Siamese CNN (PyTorch) on CEDAR
- Tampering: Error Level Analysis + CNN
- Face: Mediapipe / face_recognition; liveness simplified heuristic

## Next implementation step (weeks 3–4)

1. FastAPI skeleton + health
2. Stub endpoints returning mock scores
3. Train signature model on CEDAR; wire real inference
4. Integrate OCR + ELA
