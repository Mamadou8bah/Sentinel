import { useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { ThemeProvider, useTheme } from '../../theme/ThemeContext'
import { BrandMark } from './BrandMark'
import { Icon, type IconName } from './icons'
import { riskLabel } from './ui'

type NavItem = {
  to: string
  label: string
  roles: Array<'ADMIN' | 'COMPLIANCE' | 'ANALYST'>
  icon: IconName
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
  { to: '/desk/audit', label: 'Audit log', roles: ['ADMIN', 'COMPLIANCE'], icon: 'audit' },
]

const titles: Array<[RegExp, string]> = [
  [/^\/desk\/?$/, 'Overview'],
  [/^\/desk\/cases\/\d+/, 'Case'],
  [/^\/desk\/cases/, 'Cases'],
  [/^\/desk\/customers\/\d+/, 'Customer'],
  [/^\/desk\/customers/, 'Customers'],
  [/^\/desk\/tools/, 'Tools'],
  [/^\/desk\/analytics/, 'Analytics'],
  [/^\/desk\/settings/, 'Settings'],
  [/^\/desk\/audit/, 'Audit log'],
]

function navItemClass({ isActive }: { isActive: boolean }) {
  return [
    'relative flex h-9 items-center gap-2.5 rounded-md px-3 text-sm transition-colors',
    isActive
      ? 'bg-surface-raised font-semibold text-content before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-sm before:bg-accent'
      : 'text-content-muted hover:bg-surface-raised hover:text-content',
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
      <div className="flex h-14 items-center border-b border-line px-4">
        <NavLink to="/desk" className="rounded-md" onClick={onNavigate} aria-label="Sentinel desk, overview">
          <BrandMark size={24} />
        </NavLink>
        <span className="ml-2 text-xs text-content-subtle">Desk</span>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4" aria-label="Desk">
        <div>
          <p className="mb-1 px-3 text-xs font-medium text-content-subtle">Workspace</p>
          <div className="space-y-0.5">
            {visiblePrimary.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={navItemClass} onClick={onNavigate}>
                <Icon name={link.icon} />
                {link.label}
              </NavLink>
            ))}
          </div>
        </div>

        {visibleAdmin.length > 0 && (
          <div>
            <p className="mb-1 px-3 text-xs font-medium text-content-subtle">Administration</p>
            <div className="space-y-0.5">
              {visibleAdmin.map((link) => (
                <NavLink key={link.to} to={link.to} className={navItemClass} onClick={onNavigate}>
                  <Icon name={link.icon} />
                  {link.label}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="space-y-1 border-t border-line p-2">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-semibold text-content">{session?.username}</p>
          <p className="truncate text-xs text-content-subtle">
            <span className="font-mono">{session?.tenantCode}</span> · {riskLabel(session?.role)}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          aria-pressed={theme === 'light'}
          className="flex h-9 w-full items-center gap-2.5 rounded-md px-3 text-sm text-content-muted transition-colors hover:bg-surface-raised hover:text-content"
        >
          <Icon name={theme === 'light' ? 'sun' : 'moon'} />
          Light theme
          <span className="ml-auto text-xs text-content-subtle">{theme === 'light' ? 'On' : 'Off'}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            logout()
            navigate('/desk/login')
            onNavigate?.()
          }}
          className="flex h-9 w-full items-center gap-2.5 rounded-md px-3 text-sm text-content-muted transition-colors hover:bg-surface-raised hover:text-content"
        >
          <Icon name="logout" />
          Sign out
        </button>
      </div>
    </div>
  )
}

function DeskShellInner() {
  const { isDemo } = useAuth()
  const { theme } = useTheme()
  const location = useLocation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)

  // Per-route document title, and focus to the page heading on navigation.
  useEffect(() => {
    const match = titles.find(([re]) => re.test(location.pathname))
    document.title = `${match ? match[1] : 'Desk'} · Sentinel desk`
    dialogRef.current?.open && dialogRef.current.close()
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const id = window.setTimeout(() => {
      const h1 = mainRef.current?.querySelector<HTMLElement>('h1')
      ;(h1 ?? mainRef.current)?.focus({ preventScroll: false })
    }, 0)
    return () => window.clearTimeout(id)
  }, [location.pathname])

  function openMenu() {
    dialogRef.current?.showModal()
  }

  function closeMenu() {
    dialogRef.current?.close()
  }

  return (
    <div data-surface="desk" data-theme={theme} className="min-h-screen bg-surface-page text-content">
      <a
        href="#desk-main"
        className="sr-only z-50 rounded-md bg-surface px-3 py-2 text-sm font-medium text-content focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-surface-sunken lg:block">
        <SidebarNav />
      </aside>

      {/* Mobile navigation drawer on a native modal dialog (focus trap + Escape). */}
      <dialog
        ref={dialogRef}
        aria-label="Desk navigation"
        onClose={() => menuButtonRef.current?.focus()}
        onClick={(e) => {
          if (e.target === dialogRef.current) closeMenu()
        }}
        className="m-0 h-full max-h-none w-[min(18rem,86vw)] max-w-none border-r border-line bg-surface-sunken p-0 text-content lg:hidden"
      >
        <div className="relative h-full">
          <button
            type="button"
            onClick={closeMenu}
            aria-label="Close menu"
            className="absolute right-2 top-2.5 z-10 grid h-9 w-9 place-items-center rounded-md text-content-muted hover:bg-surface-raised hover:text-content"
          >
            <Icon name="close" />
          </button>
          <SidebarNav onNavigate={closeMenu} />
        </div>
      </dialog>

      <div className="lg:pl-60">
        {isDemo && (
          <div role="note" className="border-b border-line bg-surface-raised px-4 py-1.5 text-center text-xs text-content-muted">
            <span className="font-semibold text-content">Demo data.</span> The API is offline, so the desk is
            showing sample records. Nothing here is live.
          </div>
        )}

        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface-page px-4 lg:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            aria-label="Open menu"
            onClick={openMenu}
            className="grid h-11 w-11 place-items-center rounded-md text-content hover:bg-surface-raised"
          >
            <Icon name="menu" size={20} />
          </button>
          <BrandMark size={22} />
        </header>

        <main id="desk-main" ref={mainRef} tabIndex={-1} className="min-w-0 px-4 py-6 outline-none sm:px-6 lg:px-8">
          <div className="s-enter mx-auto w-full max-w-[1440px]" key={location.pathname}>
            <Outlet />
          </div>
        </main>
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
