# Demo script (defense / bank pilot story)

Tell the **bank** story: the client registers with the bank; Sentinel verifies and supports compliance.

1. **Narrative setup** — Fatou applies at the bank (or via bank app at home). Staff/integration submits ID + starts a **liveness challenge** in Sentinel → `Customer` PENDING → processing → WebSocket complete with scores (fail-closed if spoof/quality fails).
2. **Enroll signature specimen** (KYC strip / branch) — required before signature *match*.
3. **Genuine cheque** with specimen on file → low tamper + high signature match; clean path.
4. **Forged / mismatched signature** or **no specimen on high-value doc** → flagged Case; show explanation (including SKIPPED_NO_REFERENCE if relevant).
5. **Real-time TX** — bank calls score API on a payment → ALLOW/REVIEW/BLOCK + anomaly explanation; hot path may open Case.
6. **Compliance officer** — review case → decision + note → **AuditLog**.
7. **Admin** — trends, tiers, tenant risk weights.
8. **(Integration)** — service-auth KYC session + TX score + webhook to “bank core.”

Demonstrates: RBAC, dual-channel product thinking, async architecture, anti-spoof KYC bar, ML integration, real-time UX, and audit/compliance posture.
