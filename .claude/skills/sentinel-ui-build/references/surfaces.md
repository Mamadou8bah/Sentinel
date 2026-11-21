# Sentinel surfaces

## Staff desk — `src/pages/desk/*`, `components/desk/*`

Users: bank compliance officers, analysts and tenant admins, working long sessions. Roles: `ADMIN` (settings, analytics), `COMPLIANCE` (case decisions), `ANALYST` (uploads, investigation).

Jobs, in priority order: work the case queue (Cases → Case detail → decision with reason), look up a customer (Customers → 360° view with KYC, documents, transactions, risk history), check document and transaction signals, review analytics, read the audit log, manage tenant settings and API credentials.

Design for: density and scanning, keyboard-friendly tables, consistent risk semantics, evidence next to the decision, live case events (STOMP) shown as live with a staleness indicator. A world of instruments and night shifts: calm graphite surfaces, one accent, colour reserved for risk.

## Hosted KYC page — `src/pages/HostedKycPage.tsx`, `components/kyc/*`

Users: a bank's end customer, on a phone, often mid-onboarding inside the bank's flow, possibly on a weak connection.

Jobs: understand what is being asked and why, capture ID, complete the liveness challenge and selfie, see an honest outcome (submitted / needs retry / pending review). Must not show Sentinel internals, scores or staff language.

Design for: one task per screen, large touch targets, camera framing guides, plain-language capture errors, progress indication, retention of completed steps on retry, reduced motion. Neutral, trustworthy styling that sits comfortably inside a bank's own brand.

## Landing — `src/pages/LandingPage.tsx`, `components/landing/*`

**Frozen: the user does not want any change to the landing page.** The notes below describe it for context only.

Users: bank product/engineering leads and FYP assessors.

Jobs: understand what Sentinel does (KYC, document checks, transaction scoring, cases), how a bank integrates (API key, score call, review desk), and see the product. Claims must be true for a final-year project; no invented customers or metrics.

Design for: a headline that says what it does for whom, a real product view as the visual, a clear integration story, one primary action. Decorative background effects are not the moment.
