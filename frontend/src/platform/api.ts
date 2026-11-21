export type PlatformSession = { accessToken: string; username: string; role: 'PLATFORM_ADMIN'; expiresAt: string }
export type Tenant = { id: number; code: string; name: string; enabled: boolean; createdAt: string; staff: number; customers: number; transactions: number; cases: number; webhookUrl: string | null; webhookSecretConfigured: boolean }
export type Staff = { id: number; username: string; role: 'ADMIN' | 'COMPLIANCE' | 'ANALYST'; enabled: boolean; createdAt: string }
export type ApiKey = { id: number; name: string; prefix: string; enabled: boolean; createdAt: string; lastUsedAt: string | null }
export type TenantDetail = { tenant: Tenant; staff: Staff[]; keys: ApiKey[] }
export type Page<T> = { items: T[]; total: number; page: number; size: number }
export type Audit = { id: number; actor: string; action: string; tenantId: number | null; detail: string; createdAt: string }
export type Summary = { tenants: number; enabledTenants: number; staff: number; customers: number; transactions: number; cases: number }
const KEY = 'sentinel.platform.session'
export const EXPIRED = 'sentinel:platform-expired'
export function readSession(): PlatformSession | null {
  try { const value = JSON.parse(sessionStorage.getItem(KEY) || 'null') as PlatformSession | null
    return value?.role === 'PLATFORM_ADMIN' && value.accessToken && Date.parse(value.expiresAt) > Date.now() ? value : null
  } catch { return null }
}
export function saveSession(value: PlatformSession | null) {
  if (value) sessionStorage.setItem(KEY, JSON.stringify(value)); else sessionStorage.removeItem(KEY)
}
export async function request<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController(), token = readSession()?.accessToken
  const cancel = () => controller.abort()
  signal?.addEventListener('abort', cancel, { once: true }); if (signal?.aborted) controller.abort()
  const timer = setTimeout(cancel, 45000)
  try {
    const response = await fetch(`${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/api/platform${path}`, {
      method, credentials: 'omit', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(token && path !== '/auth/login' ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    if ((response.status === 401 || response.status === 403) && path !== '/auth/login') { saveSession(null); window.dispatchEvent(new Event(EXPIRED)) }
    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw new Error(response.status >= 500
        ? method === 'GET' ? 'Sentinel is unavailable. Try refreshing shortly.' : 'Could not confirm the change. Refresh and check the audit log before trying again.'
        : error?.message || `Request failed (${response.status})`)
    }
    return response.status === 204 ? undefined as T : await response.json() as T
  } catch (error) {
    if (error instanceof TypeError || (error instanceof DOMException && error.name === 'AbortError'))
      throw new Error(method === 'GET' ? 'Unable to connect. Try refreshing shortly.' : 'Could not confirm the request. Check the audit log before trying again.')
    throw error
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel) }
}
