# Admin module

**Owns:** institution-level configuration and analytics for bank operators.  
**Requirements:** FR-19, FR-26.

## What this module is

Admins tune risk policy and watch fraud trends. Not day-to-day case work (that’s **casemanagement**). Single-institution deploy in P0–P2; multi-bank tenancy in P3.

## Flow

- GET/PUT risk weights → backed by `risk.RiskSettings` → **audit** on change.
- Analytics endpoints feed staff charts (trends, tiers, model surfaces).

## What’s here now

Scaffold. Controllers in P0/P1.
