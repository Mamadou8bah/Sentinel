# Sentinel redesign audit — November 2026 (staff desk and hosted KYC)

Read-only audit of `frontend/` (React 18 + Vite + Tailwind 3). Covers the **staff desk** (`src/pages/desk/*`, `src/components/desk/*`) and the **hosted KYC page** (`src/pages/HostedKycPage.tsx`, `src/components/kyc/*`), plus the shared tokens in `src/index.css` and `tailwind.config.js`.

**The marketing landing is out of scope and frozen** (`AGENTS.md`). That covers `LandingPage.tsx`, `components/landing/*` and the effect components `FloatingLines`, `PixelBlast`, `Strands` and `ShapeWaves`. Nothing below proposes editing those files, and every token change is scoped so the landing renders exactly as today (section 4.0). Where the desk or KYC page *uses* a landing-owned component (`SentinelLogo`, `Strands`, `ShapeWaves`), the change is to stop using it in desk/KYC code, never to edit the component.

Method: the `sentinel-ui-build` surface rules; `unslop` signs and tokens; the `frontend-design`, `better-accessibility` and `web-design-guidelines` checklists; and the Zender design practice (`zender/docs/design/redesign-research-2026-11.md`, Operations section; `zender/packages/ui/src/components.tsx`, `icons.tsx`, `foundation.css`). From Zender we take patterns only, not its navy/amber brand. Findings come from source, not renders. Contrast ratios were computed with the WCAG 2.x formula. `file:line` paths are relative to `frontend/`.

**Ratings: staff desk — heavy slop. Hosted KYC — light slop**, meaning the step structure is sound and the slop is mostly skin borrowed from the landing. KYC still has two blocking defects, K-1 and K-2.

---

## 0. Shared tokens and global styles (as they affect desk and KYC)

| # | Finding | Where | Landing impact |
|---|---|---|---|
| T-1 | Hue-gradient primary fill `#FF6A2A → #FF4515 → #A01600` used for desk and KYC buttons (10 desk uses, 2 KYC) | `tailwind.config.js:21` | Landing also uses it, so keep the token and stop using it in desk/KYC |
| T-2 | White text on the gradient's lead colours is 2.86:1 (`#FF6A2A`) and 3.43:1 (`#FF4515`), below 4.5:1 | `tailwind.config.js:13-15` | same as T-1 |
| T-3 | `text-ember-glow` is a hard-coded `#FF6A2A`, so the light-theme `--ember-glow: #d63a0f` never applies. In light desk, ember text is 2.86:1 on white and 2.56:1 on `#f2f3ee` | `tailwind.config.js:15` vs `index.css:42` | Do not repoint the shared key. The desk gets its own `accent-ink` token |
| T-4 | `.liquid-glass` uses a gradient fill, a soft-light pseudo-highlight, `blur(28px) saturate(160%)` and an inset highlight. It is on every desk Panel, the sidebar and the KYC cards (20 uses) | `index.css:95-151` | The landing navbar uses it, so leave it and stop using it in desk/KYC |
| T-5 | Olive-tinted ramp (`--ink #070a00`, `--panel #11140a`, light `#f2f3ee`) with no text roles. Text uses ad-hoc `fg/40 … fg/85` opacities, 10+ steps | `index.css:8-18,36-44` | Shared, so add new scoped vars instead |
| T-6 | Status tones are named by mood (`ok/warn/danger/ember`). `--status-ember` turns the brand colour into a fourth status | `index.css:26-29,52-55` | desk-only today |
| T-7 | `fadeUp` (24px, 0.8s) has no reduced-motion guard; desk login and KYC use it | `tailwind.config.js:36-43` | Landing uses it too, so keep the keyframe and stop using it in desk/KYC |
| T-8 | No `:focus-visible` style exists anywhere (0 matches); desk and KYC inputs use `outline-none` | `components/desk/ui.tsx:121`, `HostedKycPage.tsx:175` | A global ring would change the landing, so scope it (4.0) |
| T-9 | Global `[data-theme='light'] input { background:#fff !important }` | `index.css:159-165` | desk-only in practice; replace with scoped input tokens |
| T-10 | Desk theme is written to `<html data-theme>` (`theme/ThemeContext.tsx:154`) and reset to dark on unmount (`:164`). The landing only stays dark because of that reset | `theme/ThemeContext.tsx:153-166` | Scope the theme to the desk wrapper (`DeskShell.tsx:226` already sets `data-theme` on its root div) |

---

## 1. Staff desk — heavy slop

### Spacing
- `desk/DeskShell.tsx:302-303` content capped at `max-w-6xl` (1152px) with `lg:px-2 lg:py-1`. Too narrow and too tight for a work tool
- `pages/desk/CasesPage.tsx:20,123` 8 rows per page at `py-5` with `text-xl` names, which is low density for a queue (same in `CustomersPage.tsx:17,59` and `AuditPage.tsx:14,50`)
- Sibling panels mix `p-5`, `p-6` and `p-6 md:p-8` (`OverviewPage.tsx:98,114`, `CustomerDetailPage.tsx:108,116`)
- `DeskShell.tsx:131,152` 10px section labels; `:106` nav rows ~40px, fully rounded, `space-y-1`

### Color
- `DeskShell.tsx:227-255` the work surface sits on a fixed marketing photo, a Strands WebGL layer, two or three gradient layers and an ember radial wash (`:246`, `:252`)
- `components/desk/ui.tsx:93` every Panel is `.liquid-glass`: a 28px backdrop blur recomputed over moving WebGL
- **Ember means everything at once.** Active nav (`DeskShell.tsx:108`), OPEN status (`ui.tsx:55`), high risk ≥70 (`ui.tsx:70`), every primary button (`bg-ember-grad`), the active page (`ui.tsx:188`), success messages (`CaseDetailPage.tsx:186`, `CustomerDetailPage.tsx:153`, `ToolsPage.tsx:273`), the shared success/error banner (`SettingsPage.tsx:101`), tenant code (`DeskShell.tsx:186`), the theme toggle (`:179`), a headline line (`OverviewPage.tsx:88`) and the document-type pill (`ToolsPage.tsx:206`, `CaseDetailPage.tsx:136`)
- `ui.tsx:57` every RESOLVED case is green whatever the decision; `CaseDetailPage.tsx:126` the decision pill is always `ok`, so a REJECT shows green
- `CustomerDetailPage.tsx:229-230`, `ToolsPage.tsx:115` transaction tone is `flagged ? danger : ok`, so REVIEW and BLOCK both show red, and the fallbacks invent labels ('FLAG'/'OK')
- `ui.tsx:69-70` RiskBar bands (≥70 ember, ≥40 `amber-400`, else `emerald-400`) use raw palette colours and are not tied to ALLOW/REVIEW/BLOCK
- `LoginPage.tsx:125` error in `red-200` on `red-400/10`; `CasesPage.tsx:108` `text-red-500` with a `dark:` override. Error colours bypass the status tokens

### Icons
- `DeskShell.tsx:49-101` one hand-drawn set at 16px, stroke 1.6. Consistent but home-made with only 7 glyphs; the hamburger uses 1.8 (`:295`). There are no icons for search, filter, retry, close or the live state. Zender's pattern (`zender/packages/ui/src/icons.tsx`: one named-path map, 24px viewBox, a single stroke) is the model, or use lucide

### Copy
- `OverviewPage.tsx:87-88` greeting headline "Welcome, {username}" plus the slogan "Review what automation flags."
- `OverviewPage.tsx:91`, `LoginPage.tsx:82` "same Sentinel look your bank already trusts", a marketing claim inside a work tool
- `LoginPage.tsx:76-83` marketing hero on the sign-in screen
- Raw enums shown to staff: `CasesPage.tsx:83,131` "UNDER REVIEW", `CaseDetailPage.tsx:137-138` `document.type`/`signatureMatchStatus`, `ToolsPage.tsx:180-182` option labels "CHEQUE", `SettingsPage.tsx:144` "KYC_COMPLETE / CASE_*". Zender's `statusLabel()` (`components.tsx:137`) shows the fix
- Abbreviations: "Flagged TX" (`OverviewPage.tsx:111`, `AnalyticsPage.tsx:28`), "Real-time TX scoring" (`ToolsPage.tsx:66`)
- `DeskShell.tsx:178-180` theme toggle reads "Light mode · On/Off"
- `CasesPage.tsx:99` "Sort · risk"; `CasesPage.tsx:113` "will appear here instantly", which is not true when live events are off
- `CustomerDetailPage.tsx:225` falls back to the literal word "channel"

### Type
- `ui.tsx:21` every desk page title is weight 900, 36→48px, leading 0.95; `ui.tsx:19` uppercase tracked eyebrow
- `OverviewPage.tsx:100`, `AnalyticsPage.tsx:49` stat figures at weight 900. `tabular-nums` has 0 uses
- Uppercase tracked micro-labels: `ui.tsx:47` (every StatusPill), `ui.tsx:75,111`, `DeskShell.tsx:126,131,152,187`, `CaseDetailPage.tsx:111,113,120`, `OverviewPage.tsx:99,115`
- Row names at `font-display text-xl font-bold` (`CasesPage.tsx:127`, `CustomersPage.tsx:63`)
- `CustomerDetailPage.tsx:222` unformatted amount `{tx.amount} {tx.currency}` next to `pct()` percentages (cf. Zender `Money`, `components.tsx:651`)

### Layout
- Queues are card lists, not tables: `CasesPage.tsx:118-141`, `CustomersPage.tsx:54-75`, `AuditPage.tsx:48-60`, `CustomerDetailPage.tsx:217-235`. No column headers, no sticky header, no sort-by-column, no right-aligned numbers
- `CustomersPage.tsx` has no search or filter, although customer lookup is the desk's second job
- **Case detail has no evidence beside the decision.** `CaseDetailPage.tsx:106-153` shows explanation, timestamps and a one-line document summary only. There is no face match or liveness (they exist on `CustomerDetail`, `api/types.ts:56-57`, but not on the case), no tamper visual and no SHAP. `shapTopFeatures` (`api/types.ts:151`) is never rendered (`ToolsPage.tsx:112-123`)
- `OverviewPage.tsx:95-104,107-119,190-211` two rows of four equal stat cards plus three equal link cards (template grid). `AnalyticsPage.tsx:45-52` eight equal stat cards and no chart; KYC mix as a plain list (`:59-69`)
- `CaseDetailPage.tsx:161-175` APPROVE, REJECT and ESCALATE are styled as identical filter chips; a REJECT needs no confirmation
- `ToolsPage.tsx:22-26` three always-open forms on one page. Zender's rule is that forms open from a labelled action in a Modal or Drawer (`components.tsx:380-386`)

### Details
- `ui.tsx:93` 28px panels; `rounded-full` buttons, filters, nav and file buttons; a floating 28px sidebar (`DeskShell.tsx:258`). Everything is a pill
- `DeskShell.tsx:108`, `CasesPage.tsx:79`, `CaseDetailPage.tsx:169` the active state is an ember tint plus an ember inset border (neon border)
- `ui.tsx:188` active page number filled with the gradient

### Visuals
- `DeskShell.tsx:5,237-241` Strands WebGL runs behind every dark-theme desk page for the whole session. It has no visibility or intersection pause (`Strands.jsx:306,311,344`) and no reduced-motion check
- `DeskShell.tsx:228-236` marketing hero photo as the app background
- `LoginPage.tsx:6,41-66` ShapeWaves dot-matrix "SENTINEL" behind the sign-in form

### Motion
- `OverviewPage.tsx:21,97,205`, `LoginPage.tsx:133` `hover:scale` on cards and buttons
- `ui.tsx:135` the loading indicator is an `animate-pulse` ember dot
- `LoginPage.tsx:72,88` fade-up (T-7)

### Accessibility
- No focus-visible ring. `ui.tsx:121` uses a `ring-ember/20` 20%-alpha ring, which will not reach 3:1 (WCAG 1.4.11)
- Toggle buttons lack `aria-pressed` or a tab role: status filters `CasesPage.tsx:72-84`, sort `:88-100`, decisions `CaseDetailPage.tsx:162-174`
- `CaseDetailPage.tsx:189` submit stays disabled until a note is typed, with no explanation (validate on submit instead)
- Messages are not announced (no `role=status/alert`): `CaseDetailPage.tsx:186`, `SettingsPage.tsx:100-104`, `ToolsPage.tsx:103,271`, `LoginPage.tsx:124-128`, `ui.tsx:132-139`
- `DeskShell.tsx:262-274` mobile drawer: not a dialog, no focus move or trap, no Escape (cf. Zender `Drawer` on `<dialog>` with `showModal()`, `components.tsx:310-377`)
- No skip link. `document.title` is never set per route, and focus is not moved on navigation
- Low contrast meta text: `fg/40` timestamps (`CasesPage.tsx:135`, `OverviewPage.tsx:148`, `AuditPage.tsx:53`) are 3.75:1 dark and 2.59:1 light; `fg/45` labels (`CaseDetailPage.tsx:111`) are 3.01:1 light; 10px `fg/40` sidebar labels
- `ui.tsx:171-202` pagination has no `nav` landmark and no `aria-current`
- `LoginPage.tsx:16-18,149-152` demo password is prefilled and printed even when demo mode is off

### Missing states
- **Loading:** a text line only, no skeletons. `OverviewPage.tsx:61` blanks the whole page (cf. Zender `SkeletonRows` with `role="status"`, `components.tsx:256-280`)
- **Error with retry:** bare red text and no retry in `OverviewPage.tsx:62`, `CasesPage.tsx:107-109` (even though `load` exists), `CaseDetailPage.tsx:81-83`, `CustomerDetailPage.tsx:76-78`, `AnalyticsPage.tsx:20-22`, `SettingsPage.tsx:77-79`
- **Empty vs no results:** `CasesPage.tsx:110-115` says "Queue is clear" for any filter, including RESOLVED
- **Permission denied:** `auth/RequireAuth.tsx:13-14` silently redirects to `/desk`; `CaseDetailPage.tsx:155` hides the decision panel for ANALYST without a word; `ToolsPage.tsx:23-25` shows COMPLIANCE a partial page with no explanation
- **Expired session:** `auth/AuthContext.tsx:38` clears the session, so the user lands on login with no "your session expired" message. In `auto` demo mode a failed refresh switches to demo data instead (`api/client.ts:174-176`). Only the banner at `DeskShell.tsx:281-285` distinguishes it; production defaults to `false` (`api/demo/mode.ts:6`)
- **Live connection:** `CasesPage.tsx:62-66` always shows a "Live" pill, even in demo mode where `hooks/useCaseEvents.ts:21` never connects. There is no connected, reconnecting or stale state, and no STOMP error or close handler (`useCaseEvents.ts:27-38`). Model on Zender `LiveIndicator` (`components.tsx:714-738`)

---

## 2. Hosted KYC — light slop (two blocking defects)

### Spacing
- `HostedKycPage.tsx:204-205` in the liveness step, Back (auto width) and Continue (full width) stack on separate lines, while other steps use a row (`:216`, `:447`)
- `HostedKycPage.tsx:415` mis-indented block (code hygiene only)

### Color
- `HostedKycPage.tsx:259-264` Sentinel's marketing hero photo as the page background. The page should sit neutrally inside the bank's brand
- `HostedKycPage.tsx:242,308` primary button `bg-ember-grad` with 2.86–3.43:1 text (T-2)
- `HostedKycPage.tsx:133,152` ember eyebrow and ember step chip; `:165,227,320,435` liquid-glass cards and buttons

### Icons
- None used. That is acceptable, but camera, ID and retry glyphs would help comprehension on the capture steps

### Copy
- **K-1 (blocking):** `HostedKycPage.tsx:141,229-237`. The done screen says "Your automatic verification result is ready", prints the raw `kycStatus` ("VERIFIED"/"FLAGGED") and "Risk score {n}" to the bank customer. This breaks "no scores or staff language" and "never say verified before the backend says so"
- `HostedKycPage.tsx:267-268` the Sentinel logo and a "Hosted KYC" label lead the page; `:142` "Secure capture powered by Sentinel". The tenant name is secondary
- `HostedKycPage.tsx:146-157` step chips show internal keys: "1. intro · 2. id · 3. selfie · 4. review". Step 3 is a video liveness check, not a selfie
- `HostedKycPage.tsx:110-112` "Back to Sentinel" sends a bank customer to Sentinel's marketing page
- `LivenessCapture.tsx:21` "needs HTTPS or localhost"; `:20` "recording challenge is invalid". Developer language
- `HostedKycPage.tsx:413` "Place the ID inside the frame", but no frame guide is drawn; `:422` "Camera or upload"

### Type
- Weight 900 titles `HostedKycPage.tsx:108,123,136`; uppercase tracked labels `:122,133,146,228,268,286,330`; 14px body for a phone-first form (`:139,412`)

### Layout
- Good: one task per screen, `max-w-lg`, mobile-first, completed captures kept when submit fails (`:85-89` only clears on success)
- `HostedKycPage.tsx:416` ID camera preview is portrait 3:4 while ID cards are landscape

### Details and visuals
- 20–24px radii and pills throughout (`:165,227,329,415-421`); background photo as decoration (`:259`)
- `HostedKycPage.tsx:267` uses `SentinelLogo` from `components/landing/ui`, coupling the customer page to landing code

### Motion
- `HostedKycPage.tsx:277` `animate-fade-up` on every load, no reduced-motion guard

### Accessibility
- **K-2 (blocking):** `HostedKycPage.tsx:435-443` "Upload" is a `<label>` around an `<input className="hidden">` (display:none). It is not focusable, so keyboard and switch users cannot upload an ID
- `HostedKycPage.tsx:381-383` camera permission errors are swallowed; the camera silently doesn't start
- `HostedKycPage.tsx:147-157` progress `<ol>` has no `aria-current="step"` (cf. Zender `Stepper`, `components.tsx:741-766`); focus is not moved to the step heading on step change
- `HostedKycPage.tsx:215` review-step error has no `role="alert"` (the other step's error at `:162` does)
- `HostedKycPage.tsx:174-179` name input has no `autocomplete="name"`; 14px input text triggers iOS zoom
- 11px `white/45` labels are 4.48:1 (`:228,268,330`)
- Disabled Continue (`:193,205`) gives no reason
- Touch targets: primary ~50px and ghost ~44px, OK

### Missing states
- **Already submitted:** `HostedKycPage.tsx:47` only `COMPLETE` jumps to done. A `SUBMITTED` session (`:9`) reopens at the intro
- **Expiry while in progress:** `expiresAt` (`:13`) is never shown or checked; the expired screen (`:119-128`) offers no return link even when `returnUrl` exists
- **Load error:** `:105-115` offers no retry, although `load` exists
- **Weak connection:** the submit posts up to ~8MB of video as base64 JSON with only "Submitting…" (`:219`). No progress, no timeout or retry message
- **Camera denied:** `LivenessCapture.tsx:40` shows the raw DOMException message with no guidance on re-enabling

---

## 3. Direction (desk and KYC; the landing stays as it is)

- **Product.** Sentinel lets a bank verify customers, check cheques and score each payment behind its own app, and gives its compliance staff one desk to decide what automation could not clear.
- **Character.** Exact, accountable, unhurried.
- **World.** A bank's back office on a night shift: ledgers, cheque paper, stamped decisions, instrument panels. Graphite surfaces, paper-white type, one warm signal lamp.
- **Moments.** (1) The **risk verdict** in case detail and the score result: a 0–100 score on a scale with ALLOW/REVIEW/BLOCK bands, plus its top contributions as thin ranked bars. (2) The **evidence strip** beside the decision: ID crop, liveness frame, document tamper/fraud/signature figures and face-match score, drawn in code from real API fields.
- **Signature.** A **decision stamp**: a small squared mono label with a 1px rule, `REVIEW · 62`, used wherever a verdict or decision appears (queue rows, case header, score result, audit entries) and nowhere else.

**Ember orange: keep it, but only as a single restrained accent.** It is the brand's one real colour, it links the desk visually to the frozen landing, and it fits the world as the signal lamp. Rules:
1. Ember never carries risk or status. BLOCK is crimson and REVIEW is amber, both distinct from ember (4.3).
2. One solid ember (no gradient), darkened to `#C8380C` for fills so white text reaches 5.21:1. Ember text uses `#FF7A45` on dark (7.12:1) and `#B4320A` on light (6.17:1).
3. In the desk, ember appears in only three places: the one primary action per screen, the 2px active-nav indicator and the focus ring. The KYC page uses no ember.
4. If those rules cannot hold, drop ember from the desk too and keep it on the landing only.

**How the two surfaces differ**
- **Desk:** graphite ramp, dark by default with a light theme. Dense tables (36–40px rows, 13–14px body, the compact 20/15/13 scale from Zender's research), mono tabular figures, list → drawer → detail page. No background imagery or WebGL. Colour comes only from risk tones and the verdict moment.
- **Hosted KYC:** ink-tinted light ramp, light only. The tenant name is the header and "Identity check provided by Sentinel" is a footer line. A near-black ink primary button, so it sits inside any bank brand. 16px body, 48px targets, SVG framing guides over the camera, system font so nothing downloads on a weak connection. Outcome copy is always "Submitted. {bank} will confirm the result."
- **Landing:** unchanged by request. It keeps its own Roboto, ember-gradient and WebGL look; the desk and KYC deliberately stop borrowing from it.

### Patterns borrowed from Zender (not its brand)

| Zender pattern | Source | Sentinel use |
|---|---|---|
| Semantic tone map + human label + dot (`statusTone`, `statusLabel`, `Status`) | `components.tsx:18-160` | One `riskTone()`/`riskLabel()` for ALLOW/REVIEW/BLOCK, KYC, case and decision values; dot shape varies by tone |
| Dense `DataTable` (sticky `th`, `aria-sort` buttons, right-aligned `.num` with tabular figures, `hideOnMobile`, skeleton when loading) | `components.tsx:478-616`, `foundation.css:1100-1130` | Cases, Customers, Audit, Transactions. Use a real `<a>` in the first cell instead of Zender's `tr tabIndex` rows, so links open in a new tab |
| `SkeletonRows` with `role="status"`; `Empty` with action; separate "nothing yet" and "no results" | `components.tsx:235-305` | All desk lists |
| `Drawer`/`Modal` on native `<dialog>` + `showModal()`, bottom sheet on phones | `components.tsx:310-386` | Mobile nav, row preview (peek) from the case queue, Tools forms |
| Toasts (`role=status`, errors `role=alert` and longer) | `components.tsx:169-230` | Decision recorded, settings saved, webhook test |
| `LiveIndicator` "Live · 12s ago" / paused | `components.tsx:714-738` | Case queue STOMP state |
| `Stepper` with `aria-current="step"` | `components.tsx:741-766` | KYC progress |
| `Tabs` (`role=tablist`, counts) | `components.tsx:393-430` | Case status filters with counts |
| `KpiGrid`/`Kpi` linking to filtered lists ("exception board") | `components.tsx:432-475`; research, Operations item 5 | Overview |
| Single `:focus-visible` outline 3px, offset 2px | `foundation.css:346-355` | Scoped desk/KYC focus ring |
| One stroke-consistent named icon map | `icons.tsx` | Desk icon set |

Do **not** copy Zender's unguarded infinite `live-pulse` and skeleton shimmer (`foundation.css:678-695,752-759`). There is no `prefers-reduced-motion` rule in that file, so add the guard in Sentinel.

---

## 4. Proposed tokens

### 4.0 Scoping (keeps the landing pixel-identical)

- **No existing token changes.** `ink`, `panel`, `mute`, `fg`, `light`, `ember.*`, `ember-grad`, `hero-glow`, the `shadow-*`, `float`/`spinSlow`/`fadeUp`, `.glass`, `.liquid-glass`, the `:root` variables and the `index.html` font link all stay as they are. The landing reads only those.
- **New tokens live under a surface attribute.** `DeskShell` root gets `data-surface="desk"` (alongside its existing `data-theme`), and `LoginPage` gets the same. The `HostedKycPage` shell gets `data-surface="kyc"`. All new CSS variables are prefixed `--s-` and declared only under `[data-surface="desk"]`, `[data-surface="desk"][data-theme="light"]` and `[data-surface="kyc"]`.
- **New Tailwind keys only.** For example `surface`, `surface-raised`, `line`, `text-1/2/3`, `accent`, `accent-ink` and `risk-{allow,review,block,pending}`, each mapped to `rgb(var(--s-…) / <alpha-value>)`. Add font families `ui`, `mono` and `kyc`, and a `desk-in` keyframe. Shared keys are never renamed or repointed.
- **Scoped globals.** Write the focus ring as `[data-surface] :focus-visible { … }` and the reduced-motion guard as `[data-surface] *` rules. Replace the global light-input rule (T-9) with scoped `--s-input-*` tokens. Leave the rule itself in place until nothing in desk relies on it, then delete it; the landing never sets `data-theme="light"`.
- **Theme.** Stop writing `data-theme` to `<html>` (`ThemeContext.tsx:154,164`). The DeskShell wrapper already carries it (`DeskShell.tsx:226`).
- **Fonts.** Declare IBM Plex Sans and Mono via self-hosted `@font-face` in a desk stylesheet. Browsers fetch a face only when rendered text uses it, so the landing downloads nothing new. KYC uses the system stack (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`), with no download.
- **Landing-owned components.** Desk and KYC get their own `BrandMark` (logo image + wordmark in the surface font) instead of importing `SentinelLogo`. `Strands` and `ShapeWaves` are simply no longer imported by `DeskShell`/`LoginPage`.
- **Check.** Screenshot `/` at 390px and 1440px before and after each token PR and diff them.

### 4.1 Neutral ramps

Desk, graphite:

| Token | Dark | Light | Contrast |
|---|---|---|---|
| `--s-bg-sunken` (sidebar) | `#0f0f10` | `#f4f4f5` | |
| `--s-bg` page | `#141415` | `#fafafa` | |
| `--s-surface` card/table | `#19191b` | `#ffffff` | |
| `--s-surface-raised` hover/selected/th | `#232325` | `#f4f4f5` | |
| `--s-line` hairline | `#ededed` @ 8% | `#171717` @ 8% | decorative only |
| `--s-control-border` | `#6a6a70` | `#8a8a8f` | 3.27:1 on `#19191b`; 3.44:1 on white (1.4.11). Inputs sit on `--s-surface`, not raised (2.92:1 there) |
| `--s-text-1` | `#ededed` | `#171717` | 15.73:1 / 17.18:1 |
| `--s-text-2` | `#a1a1a6` | `#525252` | 7.16:1 / 7.49:1 |
| `--s-text-3` meta | `#85858b` | `#6b6b6b` | 5.02:1 bg, 4.79:1 card / 5.33:1 white |

KYC, ink light: `--s-bg #f5f7fa`, `--s-surface #ffffff`, `--s-line #111827 @ 10%`, `--s-control-border #8a8a8f`, `--s-text-1 #111827` (16.53:1 on bg), `--s-text-2 #4b5565` (7.54:1 on white), `--s-text-3 #5f687a` (5.22:1 on bg; the stock `#6b7487` is only 4.37:1), `--s-primary #111827` with white text (17.74:1).

### 4.2 Accent (desk only)

| Token | Value | Use | Contrast |
|---|---|---|---|
| `--s-accent` | `#C8380C` | primary button fill, 2px active-nav bar | white text 5.21:1; 3.53:1 vs `#141415`; 5.00:1 vs `#fafafa` |
| `--s-accent-ink` dark | `#FF7A45` | accent text, focus ring | 7.12:1 on bg, 6.79:1 on card |
| `--s-accent-ink` light | `#B4320A` | accent text, focus ring | 6.17:1 on white, 5.92:1 on `#fafafa` |
| KYC focus ring | `#111827` outline + 2px offset | | 16.53:1 |

On dark, a secondary button is `--s-surface-raised` with a hairline and text-1.

### 4.3 Semantic risk tones (text + shape, never colour alone)

| Tone | Values | Dark (on `#19191b`) | Light (on white) | Marker |
|---|---|---|---|---|
| allow | `ALLOW`, `VERIFIED`, decision `APPROVE` | `#4cc38a` 7.93:1 | `#137336` 5.94:1 | filled circle |
| review | `REVIEW`, `FLAGGED`, `ESCALATE`, case `UNDER_REVIEW` | `#e8a838` 8.43:1 | `#a15c07` 5.19:1 | filled triangle |
| block | `BLOCK`, `REJECTED`, decision `REJECT` | `#f0656a` 5.66:1 | `#c4262e` 5.73:1 | filled square |
| pending | `PENDING`, case `OPEN` | `#8fa3bf` 6.82:1 | `#4a5d7a` 6.69:1 | hollow circle |
| muted | case `RESOLVED`, signature `SKIPPED`/`NOT_ENROLLED` | text-2 | text-2 | dash. A resolved case shows its decision's tone beside it |

Tint backgrounds at 8% light and 12% dark. Measured on tint: allow 5.31:1 light / 6.47:1 dark; review 4.66:1 / 6.79:1; block 5.06:1 / 4.86:1. Score bands 0–39 allow, 40–69 review, 70–100 block, always written as text ("62 · Review"). Prefer backend thresholds (`autoFlagRiskScore`) where the API exposes them. Ember never stands in for any of these. The KYC page does not show these tones to the customer; it shows only neutral "Submitted" and "Needs a retake" copy.

### 4.4 Type

| Role | Desk | KYC |
|---|---|---|
| Family | IBM Plex Sans 400/500/600; IBM Plex Mono 400/500 for figures, IDs, stamps, timestamps | system-ui stack, 400/500/600 |
| Meta / table header | 12/16, 500, sentence case | 13/18 |
| Body / table cell | 13–14/20, 400 | 16/24 |
| Section title | 15/22, 600 | 18/26, 600 |
| Page / step title | 20/28, 500 (not 900) | 24/32, 500 |
| KPI figure | Mono 28/32, 500, `tabular-nums` | — |
| Verdict score (moment) | Mono 40/44, 500 | — |

No uppercase tracked labels. Letter spacing 0 under 16px.

### 4.5 Radii

| Element | Desk | KYC |
|---|---|---|
| Stamp, tag, keycap | 4 | 4 |
| Input, button | 8 | 12 |
| Card / panel / table container | 12 | 16 |
| Drawer, dialog, camera frame | 16 | 20 |
| Full pill | live dot only | none |

### 4.6 Motion

- Easing `cubic-bezier(0.22, 1, 0.36, 1)`. Durations: 140ms hover/press, 180ms menus/toasts/drawers, 320ms page entrance. Rise 8px. Press scale 0.98.
- Transition only `color, background-color, border-color, opacity, transform`. No `hover:scale` on cards and no `animate-pulse` loaders.
- Every entrance, skeleton shimmer and the live dot go under `@media (prefers-reduced-motion: no-preference)` inside `[data-surface]`.
- The only looping motion: the live dot while connected, plus the KYC recording countdown, which is functional.

---

## 5. Prioritized changes (highest impact first; no landing files touched)

| # | Change | Files | Size |
|---|---|---|---|
| 1 | **KYC honesty and keyboard access.** Done screen says "Submitted. {bank} will confirm the result"; remove `kycStatus`/`riskScore` display; handle `SUBMITTED`; Upload becomes a focusable button that triggers a visually hidden input; camera-denied guidance; plain step names; drop "Back to Sentinel" | `pages/HostedKycPage.tsx`, `components/kyc/LivenessCapture.tsx` | M |
| 2 | **Scoped token layer** (`data-surface`, `--s-*`, new Tailwind keys, Plex `@font-face`, scoped focus ring and reduced-motion rules, theme off `<html>`). Before/after screenshot diff of `/` | `src/index.css` (additive), `tailwind.config.js` (additive), `theme/ThemeContext.tsx`, new `components/desk/BrandMark.tsx` | M |
| 3 | **One risk-semantics map**: `riskTone`/`riskLabel` + `Status`/`Stamp` (dot shape + human label), modelled on Zender's `Status`; replaces `StatusPill`, `caseTone`, `kycTone` and `RiskBar` colours; decision carries tone; ember removed from status | `components/desk/ui.tsx`, all `pages/desk/*` consumers | M |
| 4 | **Strip the desk shell**: remove the photo, `Strands`, gradient washes and `liquid-glass`; flat sidebar with 32–36px rows and a 2px accent bar; `PageHeader` at 20/500 with no eyebrow; content max ~1440; mobile nav as a `<dialog>` drawer; login without `ShapeWaves`/hero copy, demo credentials only when demo is active | `components/desk/DeskShell.tsx`, `ui.tsx`, `pages/desk/LoginPage.tsx`, `OverviewPage.tsx` | M |
| 5 | **Case detail evidence + audited decision**: evidence strip (face match, liveness, document tamper/fraud/signature, explanation) beside a sticky decision panel; radio-group decision, REJECT confirmation, validate on submit, toast; render `shapTopFeatures` where present. Check the case DTO in `backend/` against `docs/api-contracts.md` first; do not fake missing fields | `pages/desk/CaseDetailPage.tsx`, `ToolsPage.tsx`, `components/desk/ui.tsx` | L |
| 6 | **Shared `DataTable`** (after Zender's): sticky headers, `aria-sort`, right-aligned mono figures, 36–40px rows, link in the first cell, `hideOnMobile`. Cases with status tabs and counts; Customers with search; Audit; Transactions with formatted money | new `components/desk/DataTable.tsx`, `CasesPage.tsx`, `CustomersPage.tsx`, `AuditPage.tsx`, `CustomerDetailPage.tsx` | L |
| 7 | **Desk states**: `SkeletonRows`, `Empty` vs `NoResults`, `ErrorPanel` with Retry, permission-denied view instead of a silent redirect, "Session expired, sign in again" on login, `LiveIndicator` driven by STOMP `onConnect`/`onWebSocketClose`/`onStompError` plus a demo state | `components/desk/ui.tsx`, `auth/RequireAuth.tsx`, `auth/AuthContext.tsx`, `LoginPage.tsx`, `hooks/useCaseEvents.ts`, `CasesPage.tsx` | M |
| 8 | **KYC re-skin and capture UX**: `data-surface="kyc"` ink-light tokens, tenant-led header, Stepper with `aria-current`, landscape ID frame guide over the camera, 16px inputs, upload progress and timeout/retry on submit, expiry notice from `expiresAt`, return link on expired; no background photo, glass or fade-up | `pages/HostedKycPage.tsx`, `components/kyc/LivenessCapture.tsx`, new `components/kyc/*` | M |
| 9 | **Overview and Analytics as an exception board**: greeting and slogan removed; 4 KPI tiles linking to filtered lists; recent cases as a compact table; Analytics with one main chart (KYC mix as a stacked bar, case flow) and a short table instead of 8 equal tiles (load the `dataviz` skill) | `pages/desk/OverviewPage.tsx`, `AnalyticsPage.tsx` | M |
| 10 | **Accessibility and copy sweep**: skip link, per-route `document.title` and focus to h1, `role=status`/`alert` via toasts, `aria-pressed`/`tablist` on toggles, `autocomplete` attributes, human labels for every enum, no "TX", Tools forms opened in a Modal | `DeskShell.tsx`, `App.tsx`, `ToolsPage.tsx`, `SettingsPage.tsx`, `ui.tsx` | S |

Verification after implementation: `npm run build`; render the desk and KYC at 390px and 1440px in light and dark (KYC light only); keyboard-walk the KYC flow and the case decision; label demo-mode screenshots as demo; diff the landing screenshots to confirm it did not change.
