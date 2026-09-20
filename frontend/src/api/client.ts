import type { ApiErrorBody, AuthResponse } from './types'

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

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false

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
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(init.headers)
  const isForm = init.body instanceof FormData
  if (!headers.has('Content-Type') && init.body && !isForm) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(path, { ...init, headers })

  if (res.status === 401 && retry) {
    refreshPromise ??= tryRefresh().finally(() => {
      refreshPromise = null
    })
    const ok = await refreshPromise
    if (ok) return apiFetch<T>(path, init, false)
    notifyAuthExpired()
    throw new ApiError(401, 'Session expired')
  }

  if (res.status === 204) return undefined as T

  const text = await res.text()
  const data = text ? (JSON.parse(text) as unknown) : null

  if (!res.ok) {
    const body = data as ApiErrorBody | null
    throw new ApiError(res.status, body?.message || body?.error || res.statusText)
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
