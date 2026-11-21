import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiError, demoSetting } from '../../api/client'
import { SESSION_EXPIRED_FLAG, useAuth } from '../../auth/AuthContext'
import { BrandMark } from '../../components/desk/BrandMark'
import { Field, Notice, buttonClass, inputClass } from '../../components/desk/ui'
import { readStoredTheme } from '../../theme/ThemeContext'

const DEMO_TENANT = 'demo-bank'
const DEMO_USER = 'compliance'
const DEMO_PASSWORD = 'ChangeMe123!'

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from || '/desk'
  // Demo credentials are only offered when this build can fall back to demo data.
  const demoAvailable = demoSetting() !== 'false'

  const [tenantCode, setTenantCode] = useState(demoAvailable ? DEMO_TENANT : '')
  const [username, setUsername] = useState(demoAvailable ? DEMO_USER : '')
  const [password, setPassword] = useState(demoAvailable ? DEMO_PASSWORD : '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [expired] = useState(() => {
    try {
      const flag = sessionStorage.getItem(SESSION_EXPIRED_FLAG) === '1'
      sessionStorage.removeItem(SESSION_EXPIRED_FLAG)
      return flag
    } catch {
      return false
    }
  })

  useEffect(() => {
    document.title = 'Sign in · Sentinel desk'
  }, [])

  if (isAuthenticated) return <Navigate to={from} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(tenantCode.trim(), username.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 400)) {
        setError('Those details didn’t match. Check the tenant code, username and password.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Sign-in failed. Try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      data-surface="desk"
      data-theme={readStoredTheme()}
      className="flex min-h-[100svh] flex-col items-center justify-center bg-surface-page px-4 py-10 text-content"
    >
      <main className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <BrandMark size={28} />
          <span className="text-sm text-content-subtle">Staff desk</span>
        </div>

        <form
          onSubmit={onSubmit}
          noValidate={false}
          className="rounded-xl border border-line bg-surface p-6 shadow-surface"
          aria-labelledby="login-title"
        >
          <h1 id="login-title" className="text-xl font-semibold leading-7">
            Sign in
          </h1>
          <p className="mt-1 text-sm text-content-muted">Use the tenant code your bank gave you.</p>

          {expired && (
            <Notice tone="info" className="mt-4">
              Your session expired. Sign in again to continue.
            </Notice>
          )}

          <div className="mt-5 space-y-4">
            <Field label="Tenant code">
              <input
                className={inputClass}
                value={tenantCode}
                onChange={(e) => setTenantCode(e.target.value)}
                autoComplete="organization"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </Field>
            <Field label="Username">
              <input
                className={inputClass}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
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
            <Notice tone="error" className="mt-4">
              {error}
            </Notice>
          )}

          <button type="submit" disabled={busy} className={`${buttonClass('primary')} mt-5 w-full`}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {demoAvailable && (
          <p className="mt-4 text-center text-xs text-content-subtle">
            Demo credentials: <span className="font-mono">{DEMO_TENANT}</span> /{' '}
            <span className="font-mono">{DEMO_USER}</span> / <span className="font-mono">{DEMO_PASSWORD}</span>.
            If the API is offline the desk shows labelled demo data.
          </p>
        )}
      </main>
    </div>
  )
}
