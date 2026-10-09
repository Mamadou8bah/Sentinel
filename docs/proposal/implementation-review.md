# Proposal implementation review

Reviewed on 4 October 2026 against `fyp-proposal.tex` and the two repositories.
This is a source review, not a claim that every existing feature passes an
end-to-end demonstration. The proposal and subsequent user scope decisions guide implementation.

Scope update on 7 October 2026: the user removed virtual cards. The LaTeX
proposal now reflects that decision; card issuance/spending is not a readiness
requirement. No card backend was implemented.

## Assessment

The split is coherent: Sutura owns money and the ledger; Sentinel owns identity,
scoring, cases, and compliance audit. Onboarding, durable transfer review and
signed callbacks are now implemented in source. A live cross-system demonstration
remains outstanding; automated database checks have now run against isolated PostgreSQL databases. Milestone sections below
record implementation history; the latest status follows here.

Current transfer behavior: ALLOW posts synchronously, REVIEW remains pending
without moving money, BLOCK/unavailable scoring persists a failed payment.
Signed case approval matches the exact payment and rechecks wallets, balance
and limits before execution. Receipt, posting, usage and completion commit
together. Sentinel uses a retryable webhook outbox and locks case decisions;
resolved cases cannot be decided again. Database primary keys reserve ledger
traces, and account lookup caches now belong to one posting call. Elevated
wallet tiers/caps require VERIFIED KYC. Python services now run; trained identity
models and real-data evaluation remain outstanding.

The 7 October settlement milestone adds committed payout reservations,
matched raw-body provider callbacks, merchant collection checkout, locked
reversals and wallet-history consistency. See the sibling Sutura repository's
`docs/readiness.md`, `docs/merchant-collections.md` and validation report for
current results and limits; the historical milestones below are not the current
readiness checklist.

| Proposal requirement | Source evidence | Remaining work |
| --- | --- | --- |
| Ledger-derived wallet balances | Computed balances, atomic transfer posting, unique trace reservations | Broader payment concurrency, rollback and reconciliation scenarios on PostgreSQL |
| Transfers, deposits, withdrawals, agent and merchant operations | Sutura domain services and role-specific clients exist | Verify settlement-time compliance gates, idempotency, authorisation and failure recovery |
| Hosted KYC during onboarding | Stored sessions, web/mobile flows, polling/callback refresh, verified limit checks | Runnable identity inference, approved higher caps, durable local event audit |
| Transaction scoring | Tenant API, durable transfer review and replay checks | Real counterparty context and other payment settlement paths |
| Review resolution | Case-to-transfer linkage and signed approval/rejection now exist | Live recovery/concurrency demonstration and other payment types |
| Signed callbacks | Signed transactional outbox and Sutura verifier/receipts now exist | Live two-system retry/replay and PostgreSQL validation |
| Identity inference | Runnable image validation and persistent challenge API; hosted frame capture | Trained face/OCR/tampering/anti-spoof models and labelled evaluation; current service fails closed |
| Fraud model and evaluation | Runnable rules/model API, chronological trainer, genuine SHAP explanations | PaySim dataset and held-out evaluation; current baseline trained only on labelled synthetic data |
| Staff desk and role clients | Existing web/mobile screens, including work already in progress | Connect live APIs, resolve existing frontend type errors, verify access and pagination |

Older Sentinel product documents and its README include cheque, invoice and
signature verification. Those features are outside this proposal. Preserve the
existing code, but do not expand them as part of this implementation sequence.

## First implementation milestone

- Sutura's existing fraud client now calls Sentinel's tenant-authenticated
  `/api/integration/transactions/score` endpoint instead of the former Python API.
- The adapter preserves decimal amounts, transaction/customer identifiers,
  explanations, rule flags, and Sentinel transaction/case references.
- Missing credentials, invalid/mismatched responses, unavailable scoring, review
  and block decisions stop the existing pre-execution path. Only allow proceeds.
- This is a stop-before-posting safeguard. It does **not** yet create a durable
  pending payment or implement automatic review resumption.
- Deployment configuration targets a separately running Sentinel service;
  the obsolete embedded fraud-service build context has been removed.
- Live Sentinel inference now fails with HTTP 503 on service failure or missing/
  invalid scores, rather than falling back to synthetic decisions.
- Synthetic KYC evidence cannot pass face/liveness checks. Demo transaction
  rules explicitly state that no trained model ran and no longer invent SHAP
  attributions. Synthetic KYC explanations record that the identity model did
  not run.

## Implementation order and acceptance checks

1. **Onboarding connection.** Register a Sutura customer/merchant; start a
   Sentinel KYC session using the same stable external customer ID; store the
   session; display its hosted URL. Persist verified/flagged/rejected outcomes.
   Failed or synthetic evidence must not grant verified limits.
2. **Durable payment review.** Create the product transaction before scoring;
   save reference, request fingerprint, score, case ID and pending reason.
   Review persists without a posting. Block fails without a posting. Timeout
   remains pending or fails closed. Assessment records must survive rollback.
3. **Signed callback contract.** Correlate Sentinel case events to an explicit
   transaction, not just a customer. Verify signatures and deduplicate event IDs.
   Approved review rechecks balance, status and limits before one posting;
   rejection fails it; escalation keeps it pending. Never accept a callback as
   a direct balance update.
4. **Ledger invariants.** Reserve a unique trace in the database before entries
   are posted, use transaction-local account lookups and deterministic locks.
   Test concurrent duplicate traces, concurrent overspending, currencies,
   inactive accounts, insufficient funds, reversals and reconciliation drift.
   Trace reservations and transaction-local account lookups are now implemented;
   broader payment concurrency and reconciliation scenarios still need testing.
5. **Scope update.** Virtual cards were removed by the user on 7 October 2026.
6. **Runnable inference and evaluation.** Implement Python services within
   identity and transaction scope. Record whether a model ran, evaluate held-out
   samples, distinguish rule explanations from model attribution, and report
   dataset and liveness limitations.
7. **Demonstration and report.** Show onboarding, allow/review/block, signed
   resolution, ledger traces, role failures and reconciliation. Resolve client
   compilation issues before claiming a complete demonstration.

## Proposal refinements before final reporting

- Replace broad guarantees with measurable acceptance checks and test evidence.
- Specify the review/timeout state machine and callback authentication format.
- Separate rule-only demonstrations from trained-model evaluation. Synthetic
  identity images alone do not establish real-world anti-spoof performance.
- Explain merchant owner KYC versus business-document checks and the precise
  verified privileges for customers, merchants and agents.
- Treat balance/trace checks, tenant isolation and callback replay protection as
  explicit concurrent failure scenarios, not only successful single requests.

The LaTeX proposal reflects the explicit card scope removal. Earlier milestone
notes below record the implementation history and may describe previous gaps.

## Validation for this milestone

Sutura: 17 targeted client and execution-gate tests passed. Sentinel: 7
targeted inference-gateway, hosted-KYC and API-key tests passed. The integration
API-key test also checks the scoring response contract using an authenticated
tenant and rejects scoring without an API key.

The existing Sutura deposit test now uses Spring Framework `MockitoBean`,
allowing test-source compilation on the current Spring Boot version. The
deposit/database suite and a live two-system settlement demonstration were
not run. Docker is unavailable in the current shell, so production Compose
was reviewed as configuration but not launched or validated with Docker.

## Hosted-KYC follow-up milestone

Sutura now exposes authenticated start/status/refresh endpoints, persists the
Sentinel session/customer reference against the signed-in user, and provides a
web verification screen for customers and merchant owners. Account locking
serializes session starts, pending links are reused, and flagged/verified
results cannot be discarded by starting again. Failed polling leaves the
stored status intact. Production deployments require the manual KYC-table
migration supplied in `sutura/server/sutura/db/migrations`.

18 targeted KYC tests and the 17 existing fraud tests cover this milestone.
The full Sutura web TypeScript check passes. Database-backed onboarding, mobile
registration integration, verified wallet tiers, signed callbacks and durable
review/resumption remain outstanding. See `sutura/docs/kyc-onboarding.md` from
the workspace root for endpoint and migration details.

## Mobile onboarding follow-up

Customer registration and merchant account completion now route to hosted
identity verification in their Expo clients. Existing accounts have verification
entry points. Both clients read/start/refresh via the Sutura API, preserve stored
results on outages, and refresh on app foreground. Merchant identity and
business approval remain separate. Token handlers now retain current account
fields during refresh and read the latest session when screens mount.

Both mobile clients pass TypeScript checks. Native-device and live-backend
smoke tests remain necessary. Verified wallet privileges, durable review and
signed callbacks are the next implementation milestones.

## Transfer review and signed callback milestone

The next three milestones above now have source implementations for transfers
and KYC callbacks. Sutura customer web/mobile transfers display pending and
failed responses without claiming that funds were sent. Existing deposits and
withdrawals retain their earlier initiation gates; their durable settlement
review flows are not included in this milestone. No higher wallet cap values
were invented and verification does not automatically promote tiers.

Manual PostgreSQL upgrade scripts are supplied in both backend repositories.
Configuration and callback details are in `sutura/docs/sentinel-integration.md`.
The callback secret and tenant code must be configured on Sutura, with a matching
secret and callback URL on its Sentinel tenant.

62 targeted Sutura tests pass, including actual H2 concurrent duplicate trace
reservations and rollback/retry; 10 targeted Sentinel tests pass, including real
HTTP UTF-8 signature and failed delivery retry checks. Sutura web and customer
mobile TypeScript checks pass. These checks do not establish complete PostgreSQL
atomicity, all payment concurrency invariants, or native-device integration.
