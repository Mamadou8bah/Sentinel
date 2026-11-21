---
name: sentinel-ui-build
description: Build, redesign or review Sentinel interfaces (staff compliance desk, hosted KYC capture page, marketing landing) with deliberate visual design, usable risk workflows and real API integration. Use for any Sentinel frontend change, UI polish or UX review in sentinel/frontend.
---

# Sentinel UI Build

Sentinel is a multi-tenant KYC, document-fraud and transaction-risk platform for banks. Bank systems call the API; compliance staff use the desk; bank customers only ever see the hosted KYC page. Build interfaces that make risk decisions faster and more defensible, not interfaces that look like a sci-fi movie.

## Establish the brief

Work from the `sentinel/` root. Read `AGENTS.md`, `docs/product-vision.md`, `docs/prd.md`, `docs/functional-requirements.md` and `docs/api-contracts.md` for the affected workflow. Check the real controllers/DTOs in `backend/` before trusting a doc. Read [surfaces.md](references/surfaces.md) for the audience you are building for and keep each surface's job distinct.

Record redesign decisions in `docs/design/` (research, direction, tokens) so later work follows the same direction instead of reinventing it.

## Choose the design skills for the task

Load only what the change needs; do not stack every skill on every edit.

| Task | Skill |
| --- | --- |
| Visual direction for a new or reshaped screen | `frontend-design`, then `impeccable` for shaping/critique |
| Screen still looks AI-generated (glows, gradients, WebGL filler, shouty copy) | `unslop` |
| Token, palette and contrast work | `better-colors`, `better-typography` |
| Layout, density, tables, responsive structure | `better-layout` |
| Surfaces, radii, icons, motion polish | `better-ui`, `emil-design-eng` |
| Labels, errors, empty states, confirmations | `better-writing` |
| Keyboard, focus, ARIA, forms | `better-accessibility`, `accessibility` |
| React rendering, data fetching, bundle size | `vercel-react-best-practices`, `performance`, `core-web-vitals` |
| Charts, KPI tiles, SHAP bars, analytics | `dataviz` |
| Ranked review of a finished screen | `better-interface` or `web-design-guidelines` |
| Review of a change set | `interface-review` |
| Stress-testing a component's states | `break-ui`, `state-machine` |
| Rendered verification | `playwright`, `screenshot` |

## Design and implement

- One token system in `src/index.css` + `tailwind.config.js`: neutral ramp for surfaces and text (light and dark), one accent, semantic tones for risk. Reuse `components/desk/ui.tsx` primitives before inventing new ones.
- Risk is the content, so it carries the colour. `ALLOW`/`REVIEW`/`BLOCK`, `PENDING`/`VERIFIED`/`FLAGGED`/`REJECTED` and 0–100 scores get one consistent semantic map, always text + dot/shape, never colour alone. Chrome (nav, panels, buttons) stays quiet.
- Desk = dense, scannable work tool: actionable queues first, filters with visible state, tables with right-aligned tabular numbers, sticky headers, row → detail. Case detail shows evidence (face match, liveness, OCR, tamper score, SHAP contributions) beside the decision, and every decision is audited with a reason.
- Hosted KYC = mobile-first, one step per screen, camera guidance in plain words, clear retry on poor capture, honest pending/flagged states. Never tell a customer they are "verified" before the backend says so. No staff jargon.
- Landing is frozen by the user's decision (2026-11-19): do not change `LandingPage.tsx`, `components/landing/*` or its background components (`FloatingLines`, `PixelBlast`, `Strands`, `ShapeWaves`). Token or global CSS changes for the desk/KYC must be scoped so the landing renders exactly as before; check it visually after any shared change.
- Design quality bar and patterns come from the zender workspace (`C:\Users\Mamadou\Downloads\zender`: `docs/design/*.md`, `packages/ui/src`). Borrow its patterns (status tone map, DataTable, skeletons, drawers, toasts vs inline errors), not its navy/amber brand.
- Every state the flow needs: loading skeletons, empty vs no-results, validation, permission-denied (role `ADMIN`/`COMPLIANCE`/`ANALYST`), expired session, recoverable API error with retry, stale live-event connection.
- Business rules, scoring and authorization stay in the backend. Frontend role checks only shape navigation. Demo data under `src/api/demo` must be labelled as demo and must never masquerade as live results.
- Accessibility baseline: semantic controls, visible labels, focus rings, managed dialog focus, 4.5:1 text contrast in both themes, reduced-motion support, 44px touch targets on the KYC page.

## Verify

Run `npm run build` in `frontend/`. Render changed screens at 390px and 1440px in light and dark, inspect the screenshots, and exercise keyboard paths, form errors and API failures. Distinguish demo-mode screenshots from checks against a running backend in your report. Never claim production readiness from a screenshot.
