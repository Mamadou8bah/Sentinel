import { useEffect, useState } from 'react'
import { useScrollSpy } from '../../hooks/useScrollSpy'
import { NAV_LINKS, NAV_SECTION_IDS } from './navLinks'
import { SentinelLogo } from './ui'

function navLinkClass(isActive: boolean) {
  return [
    'rounded-full px-4 py-2 text-sm transition',
    isActive
      ? 'bg-ember/30 font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,69,21,0.45)]'
      : 'text-white/75 hover:bg-white/15 hover:text-white',
  ].join(' ')
}

function mobileNavLinkClass(isActive: boolean) {
  return [
    'rounded-2xl px-2 py-4 font-display text-3xl font-black transition',
    isActive ? 'text-ember-glow' : 'text-white/80 hover:text-white',
  ].join(' ')
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const activeId = useScrollSpy(NAV_SECTION_IDS)

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  return (
    <>
      <header className="safe-top fixed inset-x-0 top-0 z-50 px-5 pt-3 md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr] md:items-center">
          {/* Mobile logo / Desktop nav (left) */}
          <div className="flex items-center md:justify-start">
            <a
              href="#home"
              aria-label="Sentinel home"
              className="inline-flex items-center md:hidden"
            >
              <SentinelLogo showWord={false} size={36} />
            </a>

            <nav
              className="liquid-glass liquid-glass-nav hidden items-center gap-1 rounded-full px-2 py-2 md:flex"
              aria-label="Primary"
            >
              {NAV_LINKS.map((item) => {
                const isActive = activeId === item.id
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={navLinkClass(isActive)}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {item.label}
                  </a>
                )
              })}
            </nav>
          </div>

          {/* Desktop center logo — no glass plate */}
          <a
            href="#home"
            aria-label="Sentinel home"
            className="mx-auto hidden items-center justify-center md:inline-flex"
          >
            <SentinelLogo showWord={false} size={42} />
          </a>

          {/* Right actions */}
          <div className="flex items-center justify-end gap-2">
            <a
              href="#contact"
              className="liquid-glass hidden h-11 w-11 place-items-center rounded-full text-sm text-white/85 transition hover:text-white md:grid"
              aria-label="Request demo"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M4 6h16v12H4z" stroke="currentColor" strokeWidth="1.6" />
                <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </a>
            <a
              href="#contact"
              className="liquid-glass hidden h-11 items-center rounded-full px-5 text-sm font-medium text-white md:inline-flex"
            >
              Walkthrough
            </a>

            <button
              type="button"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="liquid-glass grid h-11 w-11 place-items-center rounded-full text-white md:hidden"
            >
              {menuOpen ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="24" height="18" viewBox="0 0 24 18" fill="none">
                  <path d="M1 1h22M1 9h22M1 17h22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="safe-top fixed inset-0 z-[60] bg-ink/95 px-6 pb-10 pt-24 backdrop-blur-md md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute right-5 top-4 grid h-11 w-11 place-items-center text-white"
            onClick={() => setMenuOpen(false)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <nav className="flex flex-col gap-2" aria-label="Mobile primary">
            {NAV_LINKS.map((item) => {
              const isActive = activeId === item.id
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={mobileNavLinkClass(isActive)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.label}
                </a>
              )
            })}
          </nav>
          <a
            href="#contact"
            onClick={() => setMenuOpen(false)}
            className="mt-8 inline-flex rounded-full border border-white/20 px-6 py-3 text-sm font-medium"
          >
            Walkthrough
          </a>
        </div>
      )}
    </>
  )
}
