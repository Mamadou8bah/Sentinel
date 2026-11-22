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

## Capture diagnostics and portrait compatibility

Portrait recordings share the same 2,073,600-pixel and 1920-pixel maximum-edge
budget as landscape recordings. A vertical 720×1280 capture must not be rejected
by a landscape-only height limit. Decode time-budget exhaustion is a temporary
service failure, not evidence that the customer moved incorrectly.

One blurred sample may be omitted during each head-turn transition, before its
held-pose window. Repeated blur, blur during a held pose, missing faces and
multiple faces still reject the capture. At least 25 clear face observations and
all three confirmed poses remain required; face matching and anti-spoof model
thresholds are unchanged.

The inference API returns allowlisted `DOCUMENT_*` or `VIDEO_*` rejection codes.
Java maps these to customer-facing text and `retryFrom` (`document`, `recording`
or `review`). The page sends customers to the affected capture step and preserves
the unaffected evidence. Unknown upstream errors use neutral review guidance.
Logs contain only stage/code, never document images, videos, names or raw model
responses. Missing static routes return HTTP 404 instead of an unexpected 500.

## Document portraits, motion and names

Document capture differs from live-video face tracking. Up to two smaller printed
portraits may accompany one clearly dominant document portrait. Every additional
portrait must pass SFace comparison against the main portrait at the configured
face threshold. Ambiguous equal-sized portraits, different identities and
unreadable secondary portraits remain capture errors. Live video still requires
one face throughout.

Head-turn confirmation compares each held pose against the recording's neutral
pose. The minimum shift is 0.08 eye-distance units or four times the neutral
median absolute deviation, whichever is greater. At least 80% of held samples
must support the issued direction. Stationary/noisy captures and reversed prompt
orders still fail. This changes capture geometry, not identity/PAD thresholds.

Low face similarity is reported as measured instead of being zeroed before
returning the result. Approval still uses the configured matching threshold and
all other automatic checks. Similarity is not a calibrated probability.

OCR recognizes separate given-name and surname labels. Java compares the
extracted document name with the tenant-supplied account name after normalizing
spacing, accents, punctuation and token order. Exact agreement is supporting
evidence; clearly disjoint full names prevent automatic approval. Partial or
missing OCR names remain inconclusive. A matching name never overrides rejected
face, liveness or document evidence. Explanations report agreement without
including raw names in diagnostic logs.

Before reusing a pending session, the API checks its challenge against the ML
service. Lost/expired challenges are replaced by the authenticated tenant's next
start request; an already-open link is marked expired before capture begins.
Temporary inference outages remain retryable service errors and do not silently
expire valid sessions or discard completed results.

Pure document-readability failures now return `DOCUMENT_FIELDS_UNREADABLE` while
keeping the challenge usable for a corrected photo. This applies only when all
failed checks are on an allowlist of missing/unreadable document fields. Failed
liveness, face mismatch, expired documents, tampering and unknown blocking
signals retain their rejection outcomes. Case explanations preserve individual
failed-check codes and the model's face/liveness thresholds, separately from the
tenant's configured threshold. A cosine similarity is not a probability, and
changing the tenant policy is separate from fixing capture or OCR errors.
