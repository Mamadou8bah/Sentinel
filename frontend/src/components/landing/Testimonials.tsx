import { useEffect, useState, type CSSProperties } from 'react'

const stories = [
  {
    quote:
      'Banks need a score and a clear reason on each payment — not a mystery overnight report.',
    name: 'Live payment checks',
    role: 'Allow · review · block',
    image: '/images/dashboard.png',
  },
  {
    quote:
      'Signature matching only works after a specimen is on file. Without one, we skip the match instead of inventing a score.',
    name: 'Honest document checks',
    role: 'Enroll · then verify',
    image: '/images/cheque.png',
  },
  {
    quote:
      'Customers register with the bank. Staff use Sentinel. That split keeps responsibilities clear.',
    name: 'Two channels',
    role: 'Bank products · staff desk',
    image: '/images/guardian.png',
  },
  {
    quote:
      'Every serious decision should leave who, what, and when — a record that cannot be quietly rewritten.',
    name: 'Audit trail',
    role: 'Cases + lasting log',
    image: '/images/scan-face.png',
  },
]

export default function Testimonials() {
  const [active, setActive] = useState(0)
  const lastIndex = stories.length - 1

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
          Design
          <br />
          principles
        </h2>
        <div className="max-w-sm">
          <p className="text-sm text-white/75">
            Product rules we build around — not customer reviews. Clear ownership, honest scores,
            and reviewable decisions.
          </p>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-6xl md:mt-14">
        <div className="overflow-hidden">
          <div
            className="flex gap-5 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] max-md:[transform:translateX(calc(var(--i)*-19.5rem))] md:[transform:translateX(calc(var(--i)*-24.25rem))]"
            style={trackStyle}
          >
            {stories.map((t, index) => (
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
                    {t.quote}
                  </p>
                </div>

                <div className="flex items-end justify-between gap-3 px-5 pb-5 md:px-6 md:pb-6">
                  <div>
                    <p className="font-display text-lg font-bold text-white">{t.name}</p>
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                      {t.role}
                    </p>
                  </div>
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
            {stories.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to card ${i + 1}`}
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
