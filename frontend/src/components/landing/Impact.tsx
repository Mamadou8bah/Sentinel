const roles = [
  {
    title: 'Bank operations',
    body: 'Run identity checks, document review, and payment risk from your existing products — without moving customers onto another app.',
  },
  {
    title: 'Compliance officers',
    body: 'Work a clear case queue, see why something was flagged, and record decisions with a required note.',
  },
  {
    title: 'Risk & analysts',
    body: 'Investigate evidence, adjust how strict checks are for your institution, and keep a lasting record of what changed.',
  },
]

export default function Impact() {
  return (
    <section className="bg-ink px-4 py-14 sm:px-5 md:px-8 md:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-display text-[1.75rem] font-black leading-tight sm:text-3xl md:text-5xl">
          Who Sentinel is for
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm text-mute md:text-base">
          Retail customers stay on the bank&apos;s product. Sentinel sits underneath as the risk
          checks and the staff desk that reviews what cannot be cleared automatically.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-6xl gap-4 sm:mt-12 sm:gap-5 lg:grid-cols-2">
        <article className="relative min-h-[320px] overflow-hidden rounded-[22px] bg-ember-grad sm:rounded-[28px] md:min-h-[420px]">
          <img
            src="/images/scan-face.png"
            alt="KYC verification"
            className="absolute inset-0 h-full w-full object-cover mix-blend-luminosity opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <div className="absolute bottom-5 left-5 right-5 max-w-sm rounded-2xl bg-black/55 p-4 backdrop-blur-md">
            <p className="text-xs uppercase tracking-[0.16em] text-white/70">Careful by default</p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-white">
              Weak or suspicious captures are held for review. Nothing is marked verified by
              accident.
            </p>
          </div>
        </article>

        <div className="grid gap-4 sm:gap-5">
          {roles.map((role) => (
            <article key={role.title} className="rounded-[22px] bg-panel p-5 sm:rounded-[28px] sm:p-7">
              <h3 className="font-display text-xl font-bold text-white sm:text-2xl">{role.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mute sm:text-base">{role.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
