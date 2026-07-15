# Customer / KYC module

**FR:** FR-5–8  
Orchestrates multipart ID + selfie upload → async call to `POST /cv/kyc-verify` → persist scores → auto-create Case if below threshold.
