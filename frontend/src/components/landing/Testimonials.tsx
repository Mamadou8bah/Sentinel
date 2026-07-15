import { useEffect, useState, type CSSProperties } from 'react'

const testimonials = [
  {
    quote:
      'Document fraud flags and explainable risk scores cut our cheque review cycle from days to minutes.',
    name: 'Amara Okonkwo',
    role: 'Head of Compliance',
    rating: '4.9',
    image: '/images/scan-face.png',
  },
  {
    quote:
      'The live case queue means analysts see forged invoices the moment models finish — that loop is what we needed.',
    name: 'Jonas Meier',
    role: 'Fraud Analyst',
    rating: '4.8',
    image: '/images/guardian.png',
  },
  {
    quote:
      'KYC, document verification, and anomaly scoring now feed one customer risk view. Audit-ready from day one.',
    name: 'Sofia Alvarez',
    role: 'Risk Manager',
    rating: '5.0',
    image: '/images/cheque.png',
  },
  {
    quote:
      'Great experience! The design was clean and onboarding was simpler than any prior KYC tool we evaluated.',
    name: 'David Chen',
    role: 'Product Lead',
    rating: '4.8',
    image: '/images/scan-face.png',
  },
  {
    quote:
      'Sentinel collapsed three vendor workflows into one desk. Our false-positive rate dropped almost overnight.',
    name: 'Priya Nair',
    role: 'Ops Director',
    rating: '4.9',
    image: '/images/cheque.png',
  },
]

export default function Testimonials() {
  const [active, setActive] = useState(0)
  const lastIndex = testimonials.length - 1

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((i) => (i >= lastIndex ? 0 : i + 1))
    }, 4200)
    return () => window.clearInterval(id)
  }, [lastIndex])

  const prev = () => setActive((i) => (i <= 0 ? lastIndex : i - 1))
  const next = () => setActive((i) => (i >= lastIndex ? 0 : i + 1))

  const trackStyle = { ['--i' as string]: active } as CSSProperties

  return (
    <section className="overflow-hidden bg-ink px-4 py-14 sm:px-5 md:px-8 md:py-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <h2 className="font-display text-[2rem] font-black leading-[1.05] sm:text-4xl md:text-5xl">
          What Our
          <br />
          Clients Say
        </h2>
        <div className="max-w-xs">
          <div className="mb-3 flex -space-x-3">
            {testimonials.slice(0, 3).map((t) => (
              <img
                key={t.name}
                src={t.image}
                alt=""
                className="h-10 w-10 rounded-full border-2 border-ink object-cover"
              />
            ))}
          </div>
          <p className="text-sm text-white/75">
            We create digital experiences that solve real banking compliance problems.
          </p>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-6xl md:mt-14">
        <div className="overflow-hidden">
          <div
            className="flex gap-5 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] max-md:[transform:translateX(calc(var(--i)*-19.5rem))] md:[transform:translateX(calc(var(--i)*-24.25rem))]"
            style={trackStyle}
          >
            {testimonials.map((t, index) => (
              <article
                key={`${t.name}-${index}`}
                className="relative w-[18.25rem] shrink-0 overflow-hidden rounded-[28px] md:w-[23rem]"
                style={{
                  background:
                    'linear-gradient(165deg, #3a1208 0%, #8B1A00 38%, #FF4515 78%, #FF6A2A 100%)',
                }}
              >
                <div className="relative flex min-h-[12.5rem] gap-4 p-5 md:min-h-[13.5rem] md:p-6">
                  <img
                    src={t.image}
                    alt=""
                    className="h-[7.5rem] w-[6.25rem] shrink-0 rounded-2xl object-cover [mask-image:linear-gradient(90deg,#000_48%,transparent_100%)] md:h-36 md:w-[7.5rem]"
                  />
                  <p className="pt-1 text-[15px] font-medium leading-snug text-white/95 md:text-base">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>

                <div className="flex items-end justify-between gap-3 px-5 pb-5 md:px-6 md:pb-6">
                  <div>
                    <p className="font-display text-lg font-bold text-white">{t.name}</p>
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                      {t.role}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-ember-glow/95 px-3 py-1.5 text-sm font-semibold text-white">
                    {t.rating}★
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between md:mt-10">
          <div className="flex gap-3">
            <NavBtn label="Previous" onClick={prev} />
            <NavBtn label="Next" onClick={next} />
          </div>
          <div className="flex items-center gap-2">
            {testimonials.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to review ${i + 1}`}
                onClick={() => setActive(i)}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  i === active ? 'w-9 bg-ember' : 'w-2.5 bg-white/20 hover:bg-white/35'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function NavBtn({ label, onClick }: { label: string; onClick: () => void }) {
  const isNext = label === 'Next'
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-[#141414] text-white/85 transition hover:border-white/30 hover:bg-white/10"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
        {isNext ? (
          <path
            d="M4 9h10M9 4l5 5-5 5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M14 9H4M9 4L4 9l5 5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </button>
  )
}
