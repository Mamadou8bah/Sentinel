export default function Features() {
  return (
    <section id="platform" className="scroll-mt-28 bg-ink px-4 py-14 sm:px-5 md:px-8 md:py-28">
      <div className="mx-auto max-w-5xl text-center">
        <h2 className="font-display text-[2rem] font-black leading-tight tracking-tight sm:text-4xl md:text-6xl">
          Security that scales.
          <br />
          <span className="text-white/95">Intelligent. Automated.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-mute sm:mt-5 sm:text-base">
          From identity onboarding to cheque forgery and transaction anomalies — Sentinel unifies
          compliance review in one real-time case dashboard.
        </p>
      </div>

      {/* Bento: large left + two stacked right (matches design reference) */}
      <div className="mx-auto mt-10 grid max-w-6xl gap-4 sm:mt-14 sm:gap-5 lg:grid-cols-2">
        {/* Left — tall orange feature card */}
        <article className="relative min-h-[360px] overflow-hidden rounded-[28px] bg-ember sm:min-h-[420px] lg:min-h-[480px]">
          <img
            src="/sentinel_hero_image.png"
            alt="Real-time KYC and document verification"
            className="absolute inset-0 h-full w-full object-cover object-[center_20%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />

          <div className="absolute bottom-5 left-5 right-5 max-w-[280px] rounded-2xl border border-white/10 bg-black/45 p-4 shadow-glass backdrop-blur-md sm:bottom-6 sm:left-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-white/70">Monthly</p>
                <p className="font-display text-2xl font-black leading-tight text-white sm:text-[1.65rem]">
                  38% Growth
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-white/75"
                aria-label="Date range"
              >
                Mar–Apr
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <svg viewBox="0 0 240 64" className="mt-3 w-full" aria-hidden>
              <path
                d="M0 48 C36 46, 52 40, 78 38 S128 18, 154 24 S200 8, 240 12"
                fill="none"
                stroke="white"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <circle cx="154" cy="24" r="4.5" fill="white" />
              <rect x="132" y="4" width="36" height="16" rx="4" fill="white" />
              <text x="150" y="15.5" textAnchor="middle" fill="#070A00" fontSize="9" fontWeight="700">
                420
              </text>
            </svg>
          </div>
        </article>

        {/* Right — stacked stats */}
        <div className="grid gap-4 sm:gap-5 lg:grid-rows-2">
          <article className="flex flex-col justify-between rounded-[28px] bg-panel p-6 sm:p-8 lg:min-h-0">
            <div className="flex items-start justify-between">
              <img src="/senitel_logo.png" alt="" className="h-10 w-10 object-contain" />
              <span
                className="grid h-9 w-9 place-items-center rounded-full text-white/70"
                aria-hidden
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M4 12L12 4M6 4h6v6"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
            <div className="mt-10 text-center sm:mt-12">
              <p className="font-display text-5xl font-black tracking-tight text-white md:text-6xl">
                12K
              </p>
              <p className="mt-2 text-sm text-white/75 sm:text-base">
                Documents scored in the last year
              </p>
            </div>
          </article>

          <article className="grid place-items-center rounded-[28px] bg-panel p-8 text-center sm:p-10">
            <p className="font-display text-5xl font-black tracking-tight text-white md:text-6xl">
              3,200+
            </p>
            <p className="mt-2 text-sm text-white/75 sm:text-base">Cases with full audit trails</p>
          </article>
        </div>
      </div>
    </section>
  )
}
