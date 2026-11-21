import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { EXPIRED, readSession, saveSession, type PlatformSession } from './api'

const Context = createContext<{ session: PlatformSession | null; setSession: (session: PlatformSession | null) => void } | null>(null)
export function PlatformAuth({ children }: { children: ReactNode }) {
  const [session, update] = useState(readSession)
  const setSession = (next: PlatformSession | null) => { saveSession(next); update(next) }
  useEffect(() => {
    const expired = () => update(null)
    window.addEventListener(EXPIRED, expired)
    const timer = session ? setTimeout(() => setSession(null), Math.max(0, Date.parse(session.expiresAt) - Date.now())) : null
    return () => { window.removeEventListener(EXPIRED, expired); if (timer) clearTimeout(timer) }
  }, [session])
  return <Context.Provider value={{ session, setSession }}>{children}</Context.Provider>
}
export function usePlatformAuth() { const value = useContext(Context); if (!value) throw new Error('Platform auth required'); return value }
export function PlatformGuard() {
  const { session } = usePlatformAuth(), location = useLocation()
  return session ? <Outlet /> : <Navigate to="/platform/login" state={{ from: location.pathname }} replace />
}
