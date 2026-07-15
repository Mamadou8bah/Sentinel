export default function Impact() {
  return (
    <section className="bg-ink px-4 py-14 sm:px-5 md:px-8 md:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-display text-[1.75rem] font-black leading-tight sm:text-3xl md:text-5xl">
          Ready to automate compliance?
          <br />
          <span className="text-white">We&apos;re here to help.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm text-mute md:text-base">
          Tell us about your institution&apos;s fraud and KYC workflow — we&apos;ll map Sentinel to your
          review process and demo the live risk pipeline.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-6xl gap-4 sm:mt-12 sm:gap-5 lg:grid-cols-2">
        <article className="relative min-h-[320px] overflow-hidden rounded-[22px] bg-ember-grad sm:rounded-[28px] md:min-h-[420px]">
          <img
            src="/images/scan-face.png"
            alt="Biometric KYC verification"
            className="absolute inset-0 h-full w-full object-cover mix-blend-luminosity opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <div className="absolute bottom-5 left-5 right-5 max-w-sm rounded-2xl bg-black/55 p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-xs text-white/70">
              <span>Monthly verification lift</span>
              <span>Mar–Apr</span>
            </div>
            <p className="mt-1 text-sm font-medium text-ember-glow">+38% automated clearances</p>
            <svg viewBox="0 0 280 70" className="mt-3 w-full" aria-hidden>
              <path
                d="M0 55 C40 50, 60 40, 90 42 S140 20, 170 28 S230 8, 280 12"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
              />
              <circle cx="170" cy="28" r="4" fill="#FF4515" stroke="white" strokeWidth="2" />
              <text x="178" y="22" fill="white" fontSize="11">
                860
              </text>
            </svg>
          </div>
        </article>

        <div className="grid gap-5">
          <article className="rounded-[22px] bg-panel p-5 sm:rounded-[28px] sm:p-7">
            <div className="flex items-start justify-between">
              <img src="/senitel_logo.png" alt="" className="h-9 w-9 object-contain" />
              <span className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-white/70">
                ↗
              </span>
            </div>
            <p className="mt-6 font-display text-4xl font-black sm:mt-8 sm:text-5xl md:text-6xl">
              28K
            </p>
            <p className="mt-2 text-sm text-mute sm:text-base">Documents verified last year</p>
          </article>
          <article className="grid place-items-center rounded-[22px] bg-panel p-8 text-center sm:rounded-[28px] sm:p-10">
            <p className="font-display text-4xl font-black sm:text-5xl md:text-6xl">1,450+</p>
            <p className="mt-2 text-sm text-mute sm:text-base">Compliance cases closed</p>
          </article>
        </div>
      </div>
    </section>
  )
}
