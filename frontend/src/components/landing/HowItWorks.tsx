import { FormEvent, useState } from 'react'

const steps = [
  {
    label: 'Step 01',
    titleParts: ['Bank', ' starts verification'],
    body: 'Your app or branch collects the customer. Your systems ask Sentinel to verify them. The person never creates a Sentinel account.',
  },
  {
    label: 'Step 02',
    titleParts: ['Capture', ' ID, documents, payments'],
    body: 'Identity and liveness stay in your experience. Cheques need a signature on file before we match them. Each payment can be scored as it happens.',
  },
  {
    label: 'Step 03',
    titleParts: ['Review', ' cases with clear reasons'],
    body: 'When risk is high, work lands in a case queue. Officers see why it was flagged, decide with a required note, and leave a lasting record.',
  },
]

export default function HowItWorks() {
  const [index, setIndex] = useState(0)
  const step = steps[index]

  function onSubmit(e: FormEvent) {
    e.preventDefault()
  }

  return (
    <section id="how" className="scroll-mt-28 bg-ink px-4 py-14 sm:px-5 md:px-8 md:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-display text-[1.75rem] font-black sm:text-3xl md:text-5xl">
          How banks use Sentinel
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm text-mute md:text-base">
          Verify once at onboarding, check documents as they arrive, score payments in the moment,
          and escalate only what needs a human.
        </p>
      </div>

      <div id="contact" className="scroll-mt-28 mx-auto mt-10 grid max-w-6xl gap-4 sm:mt-12 sm:gap-5 lg:grid-cols-2">
        <article className="flex min-h-[340px] flex-col justify-between rounded-[22px] bg-panel p-6 sm:min-h-[420px] sm:rounded-[28px] sm:p-8 md:p-10">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-mute">{step.label}</p>
            <h3 className="mt-4 font-display text-2xl font-black leading-tight sm:text-3xl md:text-4xl">
              <span className="text-ember">{step.titleParts[0]}</span>
              {step.titleParts[1]}
            </h3>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-mute">{step.body}</p>
          </div>
          <div className="mt-8 flex items-center gap-6 text-sm font-medium sm:mt-10">
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + steps.length) % steps.length)}
              className="min-h-11 text-mute transition hover:text-white"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % steps.length)}
              className="min-h-11 text-ember transition hover:text-ember-glow"
            >
              Next &gt;
            </button>
          </div>
        </article>

        <article className="relative overflow-hidden rounded-[22px] bg-ember-grad p-3 sm:rounded-[28px] sm:p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between px-2 sm:mb-4">
            <img src="/senitel_logo.png" alt="" className="h-9 w-9 object-contain" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80">
              Demo request
            </span>
          </div>
          <form
            onSubmit={onSubmit}
            className="relative rounded-[18px] bg-[#1a1a1a] p-5 sm:rounded-[22px] sm:p-6 md:p-8"
          >
            <div
              className="pointer-events-none absolute -left-16 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full border border-dashed border-white/20"
              aria-hidden
            />
            <p className="mb-5 text-sm text-white/70">
              Want a walkthrough of onboarding, document checks, and payment risk review? Leave a
              note and we will follow up.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" name="firstName" />
              <Field label="Last name" name="lastName" />
            </div>
            <div className="mt-4">
              <Field label="Email" name="email" type="email" />
            </div>
            <div className="mt-4">
              <label className="mb-2 block text-sm text-white/70">What do you want to see?</label>
              <textarea
                name="message"
                rows={4}
                placeholder="e.g. account opening checks, cheque review, payment risk alerts…"
                className="w-full resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-ember/60"
              />
            </div>
            <div className="mt-6">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-ember-grad px-6 py-3.5 text-sm font-semibold transition hover:scale-[1.01] sm:w-auto"
              >
                Request walkthrough
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M3 7h8M7 3l4 4-4 4"
                      stroke="#FF4515"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </button>
            </div>
          </form>
        </article>
      </div>
    </section>
  )
}

function Field({
  label,
  name,
  type = 'text',
}: {
  label: string
  name: string
  type?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-white/70">{label}</span>
      <input
        name={name}
        type={type}
        className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-ember/60"
      />
    </label>
  )
}
