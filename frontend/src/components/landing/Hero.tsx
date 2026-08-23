import Strands from '../Strands/Strands'
import { ArrowCta } from './ui'

const strandsProps = {
  colors: ['#FF4515', '#FFB38A', '#FF4515'],
  count: 3,
  speed: 0.5,
  amplitude: 1,
  waviness: 1,
  thickness: 0.7,
  glow: 2.6,
  taper: 3,
  spread: 1,
  intensity: 0.6,
  saturation: 1.5,
  opacity: 1,
  scale: 1.5,
  glass: false,
  refraction: 1,
  dispersion: 1,
  glassSize: 1,
}

const signals = [
  { src: '/images/scan-face.png', label: 'KYC' },
  { src: '/images/cheque.png', label: 'Documents' },
  { src: '/images/dashboard.png', label: 'TX risk' },
]

export default function Hero() {
  return (
    <section id="home" className="relative overflow-hidden">
      <div className="relative isolate min-h-[100svh] md:hidden">
        <img
          src="/sentinel_hero_bg.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-right"
        />
        <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden>
          <Strands {...strandsProps} />
        </div>
        <img
          src="/sentinel_hero_image.png"
          alt=""
          className="absolute inset-x-[-12%] top-1/2 z-[2] mx-auto h-[80%] w-auto max-w-none -translate-y-1/2 object-contain object-center"
        />
        <div className="absolute inset-0 z-[3] bg-gradient-to-b from-black/40 via-transparent to-transparent" />
        <div className="absolute inset-0 z-[3] bg-gradient-to-t from-black via-black/80 to-transparent" />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[4] h-72 bg-gradient-to-t from-black via-black/75 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-[-15%] bottom-0 z-[4] h-80 bg-[radial-gradient(ellipse_at_bottom,rgba(255,69,0,0.28)_0%,rgba(0,0,0,0.8)_42%,transparent_78%)] blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-[5%] bottom-0 z-[4] h-40 rounded-[100%] bg-black/70 blur-3xl"
          aria-hidden
        />

        <div className="safe-bottom absolute inset-x-0 bottom-0 z-20 px-5 pb-8 pt-32">
          <p className="text-sm uppercase tracking-[0.18em] text-white/85">Built for banks</p>
          <h1 className="mt-1 font-display text-[3.35rem] font-black leading-[0.92] tracking-tight">
            <span className="block text-white">Sentinel</span>
          </h1>
          <p className="mt-4 max-w-[20rem] text-[15px] leading-snug text-white/90">
            KYC, document fraud, and live payment risk — behind your bank app, with a compliance desk
            on top.
          </p>

          <div className="mt-6">
            <ArrowCta href="#how" className="w-full max-w-xs justify-between pl-7 pr-2">
              See how it works
            </ArrowCta>
          </div>

          <div className="mt-7 flex items-center gap-3">
            <div className="flex -space-x-3">
              {signals.map((item) => (
                <img
                  key={item.label}
                  src={item.src}
                  alt=""
                  className="h-9 w-9 rounded-full border-2 border-black object-cover"
                />
              ))}
            </div>
            <p className="text-sm font-medium text-ember-glow">Built for banks · desk for staff</p>
          </div>
        </div>
      </div>

      <div className="relative hidden min-h-screen overflow-hidden md:block">
        <img
          src="/sentinel_hero_bg.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden>
          <Strands {...strandsProps} />
        </div>
        <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-r from-black/50 via-black/15 to-transparent" />

        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-8 px-8 pb-20 pt-28 md:grid-cols-[1.05fr_0.95fr]">
          <div className="animate-fade-up relative max-w-xl pb-24">
            <div
              className="pointer-events-none absolute -left-6 top-10 h-72 w-72 rounded-full border border-dashed border-white/25 animate-spin-slow"
              aria-hidden
            />

            <p className="relative text-xl text-white/80">Built for banks</p>
            <h1 className="relative mt-1 font-display text-[clamp(3.2rem,8vw,5.8rem)] font-black leading-[0.92] tracking-tight">
              <span className="block text-white">Sentinel</span>
            </h1>
            <p className="relative mt-6 max-w-md text-lg text-white/80">
              Your customers stay in your app. Sentinel checks identity, documents, and each
              payment — then gives your team clear reasons and a case desk when something needs a
              human decision.
            </p>

            <div className="relative mt-8 flex flex-wrap items-center gap-5">
              <ArrowCta href="#how">See how it works</ArrowCta>
              <div className="flex items-center gap-3">
                <div className="flex -space-x-3">
                  {signals.map((item) => (
                    <img
                      key={item.label}
                      src={item.src}
                      alt=""
                      className="h-10 w-10 rounded-full border-2 border-ink object-cover"
                    />
                  ))}
                </div>
                <p className="text-sm text-white/75">
                  <span className="font-semibold text-white">For banks</span> · staff desk · live risk
                </p>
              </div>
            </div>
          </div>

          <div className="relative flex min-h-[640px] items-end justify-center">
            <img
              src="/sentinel_hero_image.png"
              alt="Sentinel identity and document verification"
              className="relative z-10 h-[min(78vh,640px)] w-auto max-w-none object-contain drop-shadow-2xl"
            />
          </div>
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-56 bg-gradient-to-t from-ink via-ink/80 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-[-10%] bottom-0 z-20 h-72 bg-[radial-gradient(ellipse_at_bottom,rgba(255,69,0,0.24)_0%,rgba(5,5,5,0.75)_40%,transparent_78%)] blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-[15%] bottom-0 z-20 h-36 rounded-[100%] bg-black/65 blur-3xl"
          aria-hidden
        />
      </div>
    </section>
  )
}
