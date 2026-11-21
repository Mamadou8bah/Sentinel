import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import type { Role } from '../api/types'
import { PageHeader, Panel, PermissionDenied } from '../components/desk/ui'

const roleNames: Record<Role, string> = { ADMIN: 'Admin', COMPLIANCE: 'Compliance', ANALYST: 'Analyst' }

export function RequireAuth({ roles }: { roles?: Role[] }) {
  const { isAuthenticated, hasRole } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/desk/login" replace state={{ from: location.pathname }} />
  }

  // Navigation shaping only; the backend enforces authorization on every call.
  if (roles && roles.length > 0 && !hasRole(...roles)) {
    return (
      <div className="space-y-5">
        <PageHeader title="Access needed" />
        <Panel>
          <PermissionDenied need={roles.map((r) => roleNames[r]).join(' or ')} />
        </Panel>
      </div>
    )
  }

  return <Outlet />
}
