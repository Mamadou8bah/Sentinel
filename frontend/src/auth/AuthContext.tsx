import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  AUTH_EXPIRED_EVENT,
  api,
  clearAuth,
  getStoredSession,
  persistAuth,
  type StoredSession,
} from '../api/client'
import type { AuthResponse, Role } from '../api/types'

type AuthState = {
  session: StoredSession | null
  login: (tenantCode: string, username: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
  role: Role | null
  hasRole: (...roles: Role[]) => boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(() => getStoredSession())

  useEffect(() => {
    const onExpired = () => setSession(null)
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  }, [])

  const login = useCallback(async (tenantCode: string, username: string, password: string) => {
    const auth = await api.post<AuthResponse>('/api/auth/login', {
      tenantCode,
      username,
      password,
    })
    persistAuth(auth)
    setSession({
      username: auth.username,
      role: auth.role,
      tenantCode: auth.tenantCode,
      tenantId: auth.tenantId,
    })
  }, [])

  const logout = useCallback(() => {
    clearAuth()
    setSession(null)
  }, [])

  const value = useMemo<AuthState>(() => {
    const role = (session?.role as Role | undefined) ?? null
    return {
      session,
      login,
      logout,
      isAuthenticated: Boolean(session),
      role,
      hasRole: (...roles) => (role ? roles.includes(role) : false),
    }
  }, [session, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
