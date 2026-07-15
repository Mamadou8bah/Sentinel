import { ArrowCta, SentinelLogo } from './ui'

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
      <img
        src="/images/world-map.png"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-55 sm:opacity-70"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/45 to-ink/80" />

      <div className="relative z-10 mx-auto grid max-w-6xl gap-10 sm:gap-12 md:grid-cols-[1.2fr_0.7fr_0.7fr]">
        <div>
          <SentinelLogo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/75">
            Empowering financial institutions with AI-powered KYC, document fraud detection, and
            real-time transaction monitoring — one explainable risk score, one case desk.
          </p>
          <div className="mt-6">
            <ArrowCta href="#contact" className="w-full max-w-xs justify-between sm:w-auto">
              Read More
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
        © {new Date().getFullYear()} Sentinel. All rights reserved.
      </p>
    </footer>
  )
}
