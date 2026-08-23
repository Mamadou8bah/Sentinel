# Case management module

**Owns:** the compliance review queue for flagged bank clients.  
**Requirements:** FR-21–25.

## What this module is

When automated risk (KYC spoof/fail, document fraud, TX anomalies) breaches policy, Sentinel opens a **Case** for **staff** (`COMPLIANCE` / `ADMIN`). The bank’s retail client never sees this queue — they stay on the bank’s UX while officers decide here.

## Flow

1. Auto-create with score snapshot + explanation (+ optional document).
2. Staff queue `GET /api/cases`; assign; decide with mandatory note.
3. **Audit** append; WebSocket to desk; webhook to bank (P1).

## What’s here now

`CaseEntity`, enums, `CaseRepository`. REST + WS in P0.
