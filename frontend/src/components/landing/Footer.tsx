import { lazy, Suspense } from 'react'
import { ArrowCta, SentinelLogo } from './ui'

const PixelBlast = lazy(() => import('../PixelBlast/PixelBlast'))

const menus = [
  { label: 'How It Works', href: '#how' },
  { label: 'Platform', href: '#platform' },
  { label: 'Contact', href: '#contact' },
  { label: 'Privacy & Policy', href: '#privacy' },
  { label: 'Terms & Conditions', href: '#terms' },
]

const socials = ['LinkedIn', 'X / Twitter', 'GitHub', 'Email']

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/5 bg-ink px-4 py-14 sm:px-5 md:px-8 md:py-20">
      {/* PixelBlast background — Sentinel ember palette */}
      <div className="pointer-events-auto absolute inset-0 z-0 min-h-[420px]">
        <Suspense fallback={null}>
          <PixelBlast
            variant="circle"
            pixelSize={6}
            color="#FF4515"
            patternScale={3}
            patternDensity={1.2}
            pixelSizeJitter={0.5}
            enableRipples
            rippleSpeed={0.4}
            rippleThickness={0.12}
            rippleIntensityScale={1.5}
            liquid
            liquidStrength={0.12}
            liquidRadius={1.2}
            liquidWobbleSpeed={5}
            speed={0.6}
            edgeFade={0.25}
            transparent
          />
        </Suspense>
      </div>

      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-ink/80 via-ink/45 to-ink/85" />

      <div className="relative z-10 mx-auto grid max-w-6xl gap-10 sm:gap-12 md:grid-cols-[1.2fr_0.7fr_0.7fr]">
        <div>
          <SentinelLogo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/75">
            Identity checks, document fraud review, and live payment risk for banks — with clear
            reasons, a compliance case desk, and a lasting audit trail.
          </p>
          <div className="mt-6">
            <ArrowCta href="#contact" className="w-full max-w-xs justify-between sm:w-auto">
              Request walkthrough
            </ArrowCta>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 md:contents">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ember">Menus</h3>
            <ul className="mt-4 space-y-3">
              {menus.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="text-sm text-white/85 transition hover:text-white">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ember">Follow Us</h3>
            <ul className="mt-4 space-y-3">
              {socials.map((item) => (
                <li key={item}>
                  <a href="#contact" className="text-sm text-white/85 transition hover:text-white">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <p className="relative z-10 mx-auto mt-10 max-w-6xl text-xs leading-relaxed text-mute sm:mt-14">
        © {new Date().getFullYear()} Sentinel. Customers register with their bank; Sentinel is the
        risk engine and staff desk underneath.
      </p>
    </footer>
  )
}
