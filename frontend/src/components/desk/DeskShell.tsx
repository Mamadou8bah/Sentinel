import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { ThemeProvider, useTheme } from '../../theme/ThemeContext'
import Strands from '../Strands/Strands'
import { SentinelLogo } from '../landing/ui'

type NavItem = {
  to: string
  label: string
  roles: Array<'ADMIN' | 'COMPLIANCE' | 'ANALYST'>
  icon: 'grid' | 'cases' | 'users' | 'tools' | 'chart' | 'settings' | 'audit'
  end?: boolean
}

const primaryNav: NavItem[] = [
  { to: '/desk', label: 'Overview', roles: ['ADMIN', 'COMPLIANCE', 'ANALYST'], icon: 'grid', end: true },
  { to: '/desk/cases', label: 'Cases', roles: ['ADMIN', 'COMPLIANCE', 'ANALYST'], icon: 'cases' },
  { to: '/desk/customers', label: 'Customers', roles: ['ADMIN', 'COMPLIANCE', 'ANALYST'], icon: 'users' },
  { to: '/desk/tools', label: 'Tools', roles: ['ADMIN', 'COMPLIANCE', 'ANALYST'], icon: 'tools' },
]

const adminNav: NavItem[] = [
  { to: '/desk/analytics', label: 'Analytics', roles: ['ADMIN'], icon: 'chart' },
  { to: '/desk/settings', label: 'Settings', roles: ['ADMIN'], icon: 'settings' },
  { to: '/desk/audit', label: 'Audit', roles: ['ADMIN', 'COMPLIANCE'], icon: 'audit' },
]

const strandsProps = {
  colors: ['#FF4515', '#FFB38A', '#FF4515'],
  count: 3,
  speed: 0.35,
  amplitude: 0.85,
  waviness: 1,
  thickness: 0.55,
  glow: 2.2,
  taper: 3,
  spread: 1,
  intensity: 0.4,
  saturation: 1.3,
  opacity: 0.85,
  scale: 1.35,
  glass: false,
  refraction: 1,
  dispersion: 1,
  glassSize: 1,
}

function Icon({ name }: { name: NavItem['icon'] }) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' as const }
  switch (name) {
    case 'grid':
      return (
        <svg {...common}>
          <path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      )
    case 'cases':
      return (
        <svg {...common}>
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.6" />
          <rect x="4" y="7" width="16" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      )
    case 'users':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 19c0-2.8 2.7-5 6-5s6 2.2 6 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="17" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M19.5 19c0-1.8-1.2-3.3-3-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'tools':
      return (
        <svg {...common}>
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5 2.5-2.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      )
    case 'chart':
      return (
        <svg {...common}>
          <path d="M4 19V5M4 19h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M8 16V10M12 16V7M16 16v-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'audit':
      return (
        <svg {...common}>
          <path d="M8 4h8a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9 9h6M9 13h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
  }
}

function navItemClass({ isActive }: { isActive: boolean }) {
  return [
    'flex items-center gap-3 rounded-full px-4 py-2.5 text-sm transition',
    isActive
      ? 'bg-ember/30 font-semibold text-fg shadow-[inset_0_0_0_1px_rgba(255,69,21,0.45)]'
      : 'text-fg/70 hover:bg-fg/10 hover:text-fg',
  ].join(' ')
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { hasRole, session, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const visiblePrimary = primaryNav.filter((l) => hasRole(...l.roles))
  const visibleAdmin = adminNav.filter((l) => hasRole(...l.roles))

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-fg/10 px-5 py-5">
        <NavLink to="/desk" className="inline-flex items-center gap-2.5" onClick={onNavigate}>
          <SentinelLogo showWord size={34} />
        </NavLink>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-fg/55">Staff desk</p>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Desk">
        <div>
          <p className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-fg/40">
            Workspace
          </p>
          <div className="space-y-1">
            {visiblePrimary.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={navItemClass}
                onClick={onNavigate}
              >
                <Icon name={link.icon} />
                {link.label}
              </NavLink>
            ))}
          </div>
        </div>

        {visibleAdmin.length > 0 && (
          <div>
            <p className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-fg/40">
              Admin
            </p>
            <div className="space-y-1">
              {visibleAdmin.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={navItemClass}
                  onClick={onNavigate}
                >
                  <Icon name={link.icon} />
                  {link.label}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="space-y-2 border-t border-fg/10 p-4">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex w-full items-center justify-between rounded-full border border-fg/10 bg-fg/5 px-4 py-2.5 text-sm text-fg/80 transition hover:bg-fg/10 hover:text-fg"
        >
          <span>{theme === 'light' ? 'Light mode' : 'Dark mode'}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ember-glow">
            {theme === 'light' ? 'On' : 'Off'}
          </span>
        </button>

        <div className="rounded-[22px] border border-fg/10 bg-fg/5 px-4 py-3">
          <p className="truncate text-sm font-semibold text-fg">{session?.username}</p>
          <p className="mt-0.5 truncate text-xs text-ember-glow">{session?.tenantCode}</p>
          <p className="mt-2 inline-flex rounded-full border border-fg/15 bg-fg/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-fg/80">
            {session?.role}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            logout()
            navigate('/desk/login')
            onNavigate?.()
          }}
          className="w-full rounded-full border border-fg/10 bg-fg/5 px-4 py-2.5 text-sm font-medium text-fg/80 transition hover:bg-fg/10 hover:text-fg"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

function DeskShellInner() {
  const { isDemo } = useAuth()
  const { theme, isLight } = useTheme()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  return (
    <div data-theme={theme} className="relative min-h-screen bg-ink text-fg">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <img
          src="/sentinel_hero_bg.png"
          alt=""
          className={
            isLight
              ? 'absolute inset-0 h-full w-full object-cover opacity-[0.12]'
              : 'absolute inset-0 h-full w-full object-cover'
          }
        />
        {!isLight && (
          <div className="absolute inset-0 z-[1] opacity-70">
            <Strands {...strandsProps} />
          </div>
        )}
        {isLight ? (
          <>
            <div className="absolute inset-0 z-[2] bg-[#f2f3ee]" />
            <div className="absolute inset-0 z-[2] bg-gradient-to-br from-white via-[#f2f3ee] to-[#e8e9e2]" />
            <div className="absolute inset-x-0 top-0 z-[2] h-72 bg-[radial-gradient(ellipse_at_top_left,rgba(255,69,21,0.08),transparent_55%)]" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 z-[2] bg-gradient-to-br from-black/80 via-ink/75 to-black/55" />
            <div className="absolute inset-0 z-[2] bg-gradient-to-t from-ink via-transparent to-black/30" />
            <div className="absolute inset-x-0 top-0 z-[2] h-72 bg-[radial-gradient(ellipse_at_top_left,rgba(255,69,21,0.22),transparent_55%)]" />
          </>
        )}
      </div>

      {/* Fixed desktop sidebar — sits on the left spacer */}
      <aside className="desk-sidebar liquid-glass fixed bottom-3 left-3 top-3 z-40 hidden w-[16.5rem] flex-col overflow-hidden rounded-[28px] lg:flex">
        <SidebarNav />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="desk-sidebar liquid-glass absolute inset-y-3 left-3 flex w-[min(18rem,88vw)] flex-col overflow-hidden rounded-[28px] shadow-2xl">
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* One row: sidebar spacer + main column */}
      <div className="relative z-10 flex min-h-screen gap-3 p-3 max-lg:flex-col max-lg:gap-0 max-lg:p-0">
        <div className="hidden w-[16.5rem] shrink-0 lg:block" aria-hidden />

        <div className="flex min-w-0 flex-1 flex-col">
          {isDemo && (
            <div className="border-b border-ember/30 bg-ember/15 px-4 py-2 text-center text-xs font-medium text-ember-glow sm:px-6 lg:mb-3 lg:rounded-[20px] lg:border">
              Demo mode — backend offline; showing sample desk data.
            </div>
          )}

          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 backdrop-blur-md sm:px-6 lg:hidden">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
              className="liquid-glass grid h-11 w-11 place-items-center rounded-full"
            >
              <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
                <path d="M1 1h18M1 7h18M1 13h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            <SentinelLogo showWord={false} size={32} />
            <span className="w-11" aria-hidden />
          </header>

          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-2 lg:py-1">
            <div className="mx-auto w-full max-w-6xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default function DeskShell() {
  return (
    <ThemeProvider>
      <DeskShellInner />
    </ThemeProvider>
  )
}
