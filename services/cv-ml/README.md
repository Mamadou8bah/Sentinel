# CV/ML microservice

**Runtime:** Python 3.11 · FastAPI  
**Port:** 8001  
**Contract:** `docs/ml-contracts.md` · `docs/contracts/cv-ml.openapi.yaml`  
**Product bar:** bank pilot KYC — anti-spoof liveness, not a single-frame heuristic.

## Endpoints

| Path | Responsibility |
|------|----------------|
| `POST /cv/liveness/challenge` | Issue anti-spoof challenge instructions |
| `POST /cv/liveness/verify` | Score challenge response (video/frames); spoof + quality flags |
| `POST /cv/kyc-verify` | OCR ID fields, tampering, face match; uses liveness result |
| `POST /cv/document-verify` | OCR doc fields, signature match (CEDAR), tampering |
| `GET /health` | Service health |

## Packages

```
app/
  api/           route handlers
  ocr/           Tesseract / EasyOCR / TrOCR
  signature/     Siamese CNN (PyTorch), CEDAR training
  tampering/     ELA + classifier
  face/          Face match
  liveness/      Challenge-response / short-video anti-spoof
  models/        weight files (gitignored binaries)
```

## Tech choices

- OCR: Tesseract / EasyOCR / TrOCR
- Signature: Siamese CNN (PyTorch) on CEDAR
- Tampering: Error Level Analysis + CNN
- Face match: production-quality embedding/compare pipeline
- Liveness: challenge or guided short video with spoof detection (print/replay/screen)

## Implementation order

1. FastAPI skeleton + health
2. Stub endpoints matching contracts (including liveness challenge)
3. Train signature model on CEDAR; wire inference
4. OCR + tampering + face match
5. Liveness anti-spoof with eval set (live vs spoof)
