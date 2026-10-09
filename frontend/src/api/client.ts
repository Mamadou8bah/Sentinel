import type { ApiErrorBody, AuthResponse } from './types'
import { handleDemoRequest } from './demo/handlers'
import {
  disableDemoMode,
  enableDemoMode,
  isDemoActive,
  isDemoDisabled,
  isDemoForced,
  isDemoToken,
  demoSetting,
} from './demo/mode'

const ACCESS_KEY = 'sentinel.access'
const REFRESH_KEY = 'sentinel.refresh'
const SESSION_KEY = 'sentinel.session'

export type StoredSession = {
  username: string
  role: string
  tenantCode: string
  tenantId: number
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY)
}

export function getStoredSession(): StoredSession | null {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredSession
  } catch {
    return null
  }
}

export function persistAuth(auth: AuthResponse) {
  localStorage.setItem(ACCESS_KEY, auth.accessToken)
  localStorage.setItem(REFRESH_KEY, auth.refreshToken)
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      username: auth.username,
      role: auth.role,
      tenantCode: auth.tenantCode,
      tenantId: auth.tenantId,
    } satisfies StoredSession),
  )
  if (isDemoToken(auth.accessToken)) {
    enableDemoMode('demo login')
  }
}

export const AUTH_EXPIRED_EVENT = 'sentinel:auth-expired'

export function clearAuth() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(SESSION_KEY)
}

export function notifyAuthExpired() {
  clearAuth()
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

let refreshPromise: Promise<boolean> | null = null

function preferDemoOnly(token: string | null) {
  return isDemoForced() || isDemoToken(token)
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false
  if (isDemoToken(refreshToken) || isDemoActive()) {
    enableDemoMode('demo refresh')
    const auth = (await handleDemoRequest('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    })) as AuthResponse
    persistAuth(auth)
    return true
  }

  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) {
      notifyAuthExpired()
      return false
    }
    const auth = (await res.json()) as AuthResponse
    persistAuth(auth)
    return true
  } catch {
    if (!isDemoDisabled() && enableDemoMode('refresh unreachable')) {
      const auth = (await handleDemoRequest('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      })) as AuthResponse
      persistAuth(auth)
      return true
    }
    notifyAuthExpired()
    return false
  }
}

async function fromDemo<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return (await handleDemoRequest(path, init)) as T
  } catch (err) {
    const status = typeof err === 'object' && err && 'status' in err ? Number((err as { status: number }).status) : 500
    const message = err instanceof Error ? err.message : 'Demo request failed'
    throw new ApiError(status, message)
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = getAccessToken()
  if (preferDemoOnly(token)) {
    enableDemoMode('demo session')
    return fromDemo<T>(path, init)
  }

  const headers = new Headers(init.headers)
  const isForm = init.body instanceof FormData
  if (!headers.has('Content-Type') && init.body && !isForm) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res: Response
  try {
    res = await fetch(path, { ...init, headers })
  } catch {
    if (!isDemoDisabled() && enableDemoMode('network error')) {
      return fromDemo<T>(path, init)
    }
    throw new ApiError(503, 'Backend unreachable')
  }

  if (res.status === 401 && retry) {
    refreshPromise ??= tryRefresh().finally(() => {
      refreshPromise = null
    })
    const ok = await refreshPromise
    if (ok) return apiFetch<T>(path, init, false)
    if (!isDemoDisabled() && enableDemoMode('auth failed')) {
      return fromDemo<T>(path, init)
    }
    notifyAuthExpired()
    throw new ApiError(401, 'Session expired')
  }

  // Vite proxy (backend down) often returns 500; gateways use 502–504
  if (res.status >= 500 && !isDemoDisabled()) {
    enableDemoMode(`HTTP ${res.status}`)
    return fromDemo<T>(path, init)
  }

  if (res.status === 204) {
    if (demoSetting() === 'auto' && isDemoActive()) {
      disableDemoMode()
    }
    return undefined as T
  }

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text) as unknown
    } catch {
      // Non-JSON error body from a dead proxy — treat as offline
      if (!res.ok && !isDemoDisabled()) {
        enableDemoMode('proxy error')
        return fromDemo<T>(path, init)
      }
      data = null
    }
  }

  if (!res.ok) {
    const body = data as ApiErrorBody | null
    throw new ApiError(res.status, body?.message || body?.error || res.statusText)
  }

  if (demoSetting() === 'auto' && isDemoActive()) {
    disableDemoMode()
  }

  return data as T
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: body == null ? undefined : JSON.stringify(body) }),
  postForm: <T>(path: string, body: FormData) =>
    apiFetch<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: body == null ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: body == null ? undefined : JSON.stringify(body) }),
}

export { isDemoActive, enableDemoMode, disableDemoMode, isDemoForced, demoSetting } from './demo/mode'
