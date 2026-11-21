# UI skill setup

Installed 2026-11-19. Design skills are local agent guidance, not runtime dependencies. They live outside the repository:

- Claude Code: `~/.claude/skills/<skill>`
- Codex: `~/.codex/skills/<skill>`

The same set was originally installed for the Zender workspace (see its `docs/development/ui-skills.md` and `ui-skills-manifest.json` for pinned upstream commits and licences) and copied unchanged into the Claude Code directory.

## Project skill

`sentinel-ui-build` lives in this repository at `.claude/skills/sentinel-ui-build` (and a copy in `~/.codex/skills`). It holds the product boundaries, the audience for each surface, and the table of which specialist skill to use for which task. `AGENTS.md` (read by Codex, and by Claude Code through `CLAUDE.md`) points to it.

## Installed specialist skills

| Group | Skills |
| --- | --- |
| Visual direction | `frontend-design`, `impeccable`, `unslop` |
| Visual system | `better-colors`, `better-typography`, `better-layout`, `better-ui`, `emil-design-eng`, `apple-design` |
| Mobile motion | `animate-expo` |
| Writing | `better-writing` |
| Accessibility | `accessibility`, `better-accessibility` |
| Performance and quality | `vercel-react-best-practices`, `performance`, `core-web-vitals`, `best-practices`, `web-quality-audit`, `seo` |
| Review | `better-interface`, `web-design-guidelines`, `interface-review` (explicit invocation) |
| State testing | `break-ui`, `break` and `state-machine` (explicit invocation) |
| Verification | `playwright`, `screenshot` |
| Charts | `dataviz` (built into Claude Code) |

Pick the specialist for the task; do not load them all on every change. `unslop`'s hero-image step uses paid image services and must ask before every generation.
