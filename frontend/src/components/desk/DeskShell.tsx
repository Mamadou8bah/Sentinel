import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { SentinelLogo } from '../landing/ui'

const links = [
  { to: '/desk/cases', label: 'Cases', roles: ['ADMIN', 'COMPLIANCE', 'ANALYST'] },
  { to: '/desk/customers', label: 'Customers', roles: ['ADMIN', 'COMPLIANCE', 'ANALYST'] },
  { to: '/desk/tools', label: 'Tools', roles: ['ADMIN', 'COMPLIANCE', 'ANALYST'] },
  { to: '/desk/analytics', label: 'Analytics', roles: ['ADMIN'] },
  { to: '/desk/settings', label: 'Settings', roles: ['ADMIN'] },
  { to: '/desk/audit', label: 'Audit', roles: ['ADMIN', 'COMPLIANCE'] },
] as const

function navClass({ isActive }: { isActive: boolean }) {
  return [
    'rounded-full px-4 py-2 text-sm transition',
    isActive
      ? 'bg-ember/30 font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,69,21,0.45)]'
      : 'text-white/75 hover:bg-white/15 hover:text-white',
  ].join(' ')
}

export default function DeskShell() {
  const { session, hasRole, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="relative min-h-screen bg-ink text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <img
          src="/sentinel_hero_bg.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/90 to-ink" />
        <div className="absolute inset-x-[-10%] top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(255,69,21,0.18),transparent_60%)]" />
      </div>

      <header className="safe-top relative z-40 px-5 pt-3 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-0">
          <nav
            className="liquid-glass liquid-glass-nav order-2 flex items-center gap-1 overflow-x-auto rounded-full px-2 py-2 md:order-1"
            aria-label="Desk"
          >
            {links
              .filter((link) => hasRole(...link.roles))
              .map((link) => (
                <NavLink key={link.to} to={link.to} className={navClass}>
                  {link.label}
                </NavLink>
              ))}
          </nav>

          <NavLink
            to="/desk/cases"
            aria-label="Sentinel desk home"
            className="order-1 mx-auto inline-flex items-center justify-center md:order-2"
          >
            <SentinelLogo showWord={false} size={40} />
          </NavLink>

          <div className="order-3 flex items-center justify-end gap-2">
            <div className="liquid-glass flex items-center gap-2 rounded-full px-3 py-2 text-xs md:hidden">
              <span className="text-ember-glow">{session?.tenantCode}</span>
              <span className="text-white/50">{session?.role}</span>
            </div>
            <div className="liquid-glass hidden items-center gap-3 rounded-full px-4 py-2 text-sm md:flex">
              <span className="text-white/90">{session?.username}</span>
              <span className="text-white/30">·</span>
              <span className="text-ember-glow">{session?.tenantCode}</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">
                {session?.role}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                logout()
                navigate('/desk/login')
              }}
              className="liquid-glass rounded-full px-4 py-2.5 text-sm font-medium text-white/85 transition hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-5 pb-16 pt-8 md:px-8 md:pt-10">
        <Outlet />
      </main>
    </div>
  )
}
