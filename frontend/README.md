# Frontend — Sentinel React SPA

**Stack:** React 18 · TypeScript · Vite · Tailwind CSS  
**Live now:** Marketing landing aligned with the bank-integration product model  
**Next:** Staff ops desk (case queue, customer 360°, analytics) — not a public consumer signup

Customers of the bank never log into this SPA. Staff will. Banks call the Spring API with a service key. See `docs/product-vision.md`.

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
| Hero | `Hero.tsx` | Sentinel for banks — API + ops desk |
| Platform | `Features.tsx` | KYC, documents + specimens, live TX + SHAP |
| Impact | `Impact.tsx` | Who it’s for: systems, compliance, analysts |
| How it works + form | `HowItWorks.tsx` | Bank-led flow + FYP walkthrough form |
| Design decisions | `Testimonials.tsx` | Product rules carousel (not fake reviews) |
| CTA | `CinematicCta.tsx` | Plug in · score · review |
| Footer | `Footer.tsx` | Product summary + links |

## Next (app shell)

Feature folders under `src/features/*` remain for the authenticated dashboard.
