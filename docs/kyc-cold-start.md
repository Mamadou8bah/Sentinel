# KYC cold-start recovery

Integration session creation now reuses an unexpired `PENDING` session for the same tenant and trimmed external customer ID. The ML challenge is obtained before acquiring the tenant write lock, followed by a second active-session lookup under that lock. Repeated or simultaneous client requests return the same active session. No schema migration is required. Completed and expired sessions allow a fresh attempt.

The public hosted capture page uses `frontend/src/api/hostedKyc.ts`, a live-only transport independent of staff demo mode and staff authentication. Transient loading failures retry within a three-minute budget; navigation cancels retries. A connection timeout is not an identity verdict. Evidence POST requests are not automatically replayed.

Deploy this backend alongside Sutura's dedicated KYC timeout and client retry changes. See `sutura/docs/kyc-cold-start.md` in the sibling repository for the client policy. Tests cover repeated, expired/completed and concurrent session starts. Connection fixtures do not establish biometric accuracy or production availability.
