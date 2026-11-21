# Sentinel workspace guidance

## Scope

Sentinel is a multi-tenant KYC, document-fraud and transaction-risk platform for banks: Spring Boot API (`backend/`), Python CV/ML services (`services/`), and one React + Vite + Tailwind SPA (`frontend/`) containing the marketing landing, the staff desk and the hosted KYC page. Bank customers never get a Sentinel account; staff log in with tenant code + credentials; bank systems use `X-Api-Key`.

Product references: `docs/product-vision.md`, `docs/prd.md`, `docs/functional-requirements.md`, `docs/api-contracts.md`, `docs/data-model.md`.

## UI work

For any frontend implementation, redesign or UI review, use the project skill `sentinel-ui-build` (`.claude/skills/sentinel-ui-build`). It defines each surface's audience and jobs and says which installed design skill to use for which task (`frontend-design`, `impeccable`, `unslop`, `better-*`, `web-design-guidelines`, `dataviz`, `playwright`, ...). The skill setup is documented in `docs/design/ui-skills.md`; design direction and research live in `docs/design/`.

**Do not change the marketing landing page** (`frontend/src/pages/LandingPage.tsx`, `frontend/src/components/landing/*` and its background effect components). UI work targets the staff desk and hosted KYC page only, and shared CSS changes must leave the landing unchanged. Use `C:\Users\Mamadou\Downloads\zender` (`docs/design/`, `packages/ui/src`) as the design-practice reference.

Do not load every design skill on every change. Pick the specialist for the task.

## Boundaries

Platform operators use separate accounts and `/platform/login` (no tenant code).
Their `/api/platform/*` JWT scope does not grant tenant customer/case access.
Keep operator credentials, staff JWTs and integration keys separate; see
`docs/platform-administration.md`.

Keep scoring, risk rules, authorization and provider secrets in the backend. Frontend role checks shape navigation only. Demo data must be labelled as demo. Verify rendered results at mobile and desktop widths in both themes, and distinguish demo-mode screenshots from checks against a running backend when reporting.
