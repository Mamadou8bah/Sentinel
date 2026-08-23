const pillars = [
  {
    title: 'KYC behind the bank app',
    body: 'Customers open accounts in your channel. Sentinel checks their ID and liveness, then returns a clear status — without silently approving weak or suspicious captures.',
    image: '/images/scan-face.png',
    tag: 'Identity',
  },
  {
    title: 'Document fraud with specimens',
    body: 'Every cheque or invoice is checked for tampering and field consistency. Signature matching only runs when you have enrolled a specimen — otherwise we say so, honestly.',
    image: '/images/cheque.png',
    tag: 'Documents',
  },
  {
    title: 'Score every payment',
    body: 'As each payment happens, Sentinel returns allow, review, or block — with plain-language reasons your officers can act on.',
    image: '/images/dashboard.png',
    tag: 'Payments',
  },
]

export default function Features() {
  return (
    <section id="platform" className="scroll-mt-28 bg-ink px-4 py-14 sm:px-5 md:px-8 md:py-28">
      <div className="mx-auto max-w-5xl text-center">
        <h2 className="font-display text-[2rem] font-black leading-tight tracking-tight sm:text-4xl md:text-6xl">
          Engine for the bank.
          <br />
          <span className="text-white/95">Desk for compliance.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-mute sm:mt-5 sm:text-base">
          Sentinel is not a consumer signup. It sits under your banking products — and gives your
          staff one place to review what automation cannot clear.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-6xl gap-4 sm:mt-14 sm:gap-5 lg:grid-cols-3">
        {pillars.map((pillar) => (
          <article
            key={pillar.title}
            className="flex min-h-[320px] flex-col overflow-hidden rounded-[28px] bg-panel sm:min-h-[360px]"
          >
            <div className="relative h-40 overflow-hidden sm:h-44">
              <img src={pillar.image} alt="" className="h-full w-full object-cover opacity-90" />
              <div className="absolute inset-0 bg-gradient-to-t from-panel via-transparent to-black/20" />
              <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85 backdrop-blur-sm">
                {pillar.tag}
              </span>
            </div>
            <div className="flex flex-1 flex-col p-6 sm:p-7">
              <h3 className="font-display text-xl font-bold text-white sm:text-2xl">{pillar.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-mute">{pillar.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
