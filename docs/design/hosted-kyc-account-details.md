# Hosted identity capture

The tenant supplies `fullName` when creating a KYC session. Sutura derives this
from its authenticated account, not client-provided request fields. Sentinel
encrypts the supplied name on the session and uses it in preference to any public
submission name. Older integrations can omit it; OCR supplies the document name.
The hosted page no longer asks customers to type a name or document number.

Capture offers passport, ID card and driving licence. `documentType` is validated
and retained on the session; it describes the evidence and does not bypass any
face, liveness, OCR or tampering checks.

JPEG, PNG and WebP photos up to 5,000,000 bytes are accepted. High-resolution
photos are scaled proportionally to a maximum dimension of 2400 pixels, without
cropping, before upload. The video remains capped at 8,000,000 bytes. Java and
Python accept the corresponding base64 sizes inside an 18,000,000-byte request.

Vercel builds send hosted evidence directly to the Render API; other deployments
can configure `VITE_HOSTED_KYC_API_BASE_URL`. Configure the API CORS allowlist for
the hosted page's origin. The browser carries only the unguessable session token,
never an integration or inference key.

Hosted response DTOs are created within the service transaction, including lazy
tenant/customer reads. Video inference has a configurable 90-second read timeout
(`CV_ML_READ_TIMEOUT_MS`); the browser allows 150 seconds. Submission failures
distinguish expired sessions, invalid recordings, large uploads and service
outages. An uncertain response triggers a status read, never an automatic POST
replay. Captures stay in page memory for an explicit retry; they are cleared on
confirmed receipt. No offline or synthetic verification is granted.

Deploy the Java migration and ML size-limit changes with the frontend. Existing
links remain valid until their original challenge expires; newly created
sessions receive the account name from the updated Sutura backend.
When the ML service reports a lost/expired or already-bound challenge, the failed
submission rolls back and the hosted controller expires that incomplete session
in a separate transaction. Sutura revalidates pending sessions with Sentinel when
verification is started, allowing a fresh link immediately instead of waiting
for a stale local expiry. Completed verification decisions are preserved.

## Capture presentation

The hosted page uses a white, single-column canvas with Manrope typography,
quiet graphite actions and a compact four-part progress indicator. Document
types are native radio inputs with full-card hit areas, visible selected marks
and keyboard focus. Document previews contain the whole photo rather than
cropping its edges. Camera and upload controls sit together, with file limits
near them. The face-video screen previews the three prompts before recording,
highlights the current prompt and preserves a still preview after capture.
Primary actions use 52-pixel minimum heights and rounded ends. All styling is
scoped to the hosted surface; the marketing landing remains unchanged.
