import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import ShapeWaves from '../../components/ShapeWaves'
import { Field, inputClass } from '../../components/desk/ui'
import { SentinelLogo } from '../../components/landing/ui'

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from || '/desk'

  const [tenantCode, setTenantCode] = useState('demo-bank')
  const [username, setUsername] = useState('compliance')
  const [password, setPassword] = useState('ChangeMe123!')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (isAuthenticated) return <Navigate to={from} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(tenantCode.trim(), username.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-black text-white" data-theme="dark">
      <div className="absolute inset-0 z-0" aria-hidden>
        <ShapeWaves
          text="SENTINEL"
          fontFamily='Roboto Condensed, Roboto, system-ui, sans-serif'
          fontWeight={700}
          textSize={0.55}
          shapes="mixed"
          cellSize={10}
          dotSize={0.75}
          color="#6e6e6e"
          hoverColor="#FF6A2A"
          backgroundColor="#000000"
          speed={1}
          scale={1}
          contrast={1}
          brightness={0.4}
          flow={0}
          direction={0}
          fade={0.25}
          interactive={true}
          splashRadius={40}
          splashStrength={0.4}
          glow={0.35}
          intro={true}
          introDuration={1.6}
          paused={false}
        />
      </div>
      <div className="absolute inset-0 z-[1] bg-gradient-to-r from-black/75 via-black/45 to-black/20" />
      <div className="absolute inset-0 z-[1] bg-gradient-to-t from-black via-transparent to-black/35" />

      <div className="relative z-10 mx-auto grid min-h-[100svh] max-w-7xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:px-8">
        <div className="animate-fade-up max-w-lg">
          <Link to="/" className="inline-flex">
            <SentinelLogo size={44} />
          </Link>
          <p className="mt-10 text-sm uppercase tracking-[0.18em] text-white/70">Staff desk</p>
          <h1 className="mt-2 font-display text-5xl font-black leading-[0.92] tracking-tight md:text-6xl">
            Review what
            <span className="block text-ember-glow">automation flags.</span>
          </h1>
          <p className="mt-5 max-w-md text-base text-white/75">
            Case queue, customer 360°, and live risk — same Sentinel look your bank already trusts.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="liquid-glass animate-fade-up w-full max-w-md rounded-[28px] p-7 md:justify-self-end md:p-8"
        >
          <h2 className="font-display text-2xl font-bold">Sign in</h2>
          <p className="mt-1 text-sm text-white/60">Tenant-scoped staff access</p>

          <div className="mt-7 space-y-4">
            <Field label="Tenant">
              <input
                className={inputClass}
                value={tenantCode}
                onChange={(e) => setTenantCode(e.target.value)}
                autoComplete="organization"
                required
              />
            </Field>
            <Field label="Username">
              <input
                className={inputClass}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>
          </div>

          {error && (
            <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-6 inline-flex w-full items-center justify-between rounded-full bg-ember-grad px-6 py-3.5 text-sm font-semibold text-white transition hover:scale-[1.01] disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Enter desk'}
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path
                  d="M3 7h8M7 3l4 4-4 4"
                  stroke="#FF4515"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>

          <p className="mt-5 text-center text-xs text-white/45">
            Demo · demo-bank / compliance / ChangeMe123!
            <br />
            Works offline when the API is down (auto demo mode).
          </p>
        </form>
      </div>
    </div>
  )
}
