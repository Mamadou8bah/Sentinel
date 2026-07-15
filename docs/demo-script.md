# Demo script (defense / interview)

1. **Onboard** a new customer live (mock ID + selfie) → KYC score in seconds / processing → WebSocket complete.
2. **Upload genuine cheque** → low risk, auto-accepted path (no case or low-priority info).
3. **Upload forged cheque** (pre-prepared) → flagged case; dashboard updates live; show explanation string.
4. **Import transaction batch** → anomalies detected; customer risk score recalculates.
5. **Compliance Officer** view → review flagged case → approve/reject with note → show AuditLog entry.
6. **Admin analytics** → fraud trend chart, cases by risk tier, model metrics summary.

This script demonstrates: security/RBAC, async architecture, ML integration, real-time UX, and audit/compliance thinking.
