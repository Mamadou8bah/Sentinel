# Frontend — Sentinel React SPA

**Stack:** React 18 · TypeScript · Vite · Tailwind CSS  
**Live now:** Marketing landing page (dark / ember design system from FYP references)

## Run

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Landing structure

| Section | Component | Content |
|---------|-----------|---------|
| Hero | `Hero.tsx` | Brand-first Sentinel hero, guardian visual, glass metric |
| Platform | `Features.tsx` | Risk scores, KYC, noise reduction + demo CTA |
| Impact | `Impact.tsx` | Stats bento (verifications, cases) |
| How it works + form | `HowItWorks.tsx` | 3-step carousel + demo request form |
| Testimonials | `Testimonials.tsx` | Compliance / analyst quotes carousel |
| Cinematic CTA | `CinematicCta.tsx` | Framed “Get Started” |
| Footer | `Footer.tsx` | World map, menus, socials |

## Next (app shell)

Feature folders under `src/features/*` remain for the authenticated dashboard (weeks 10–11).
