# Integration module

WebClient (or RestTemplate) clients for:

- `CV_ML_BASE_URL` → `/cv/kyc-verify`, `/cv/document-verify`
- `TRANSACTION_ML_BASE_URL` → `/ml/transaction-score`

Wrap with `@Async` jobs; handle timeouts/errors → mark entity FAILED.
