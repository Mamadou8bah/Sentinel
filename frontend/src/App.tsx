import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'
import DeskShell from './components/desk/DeskShell'
import LandingPage from './pages/LandingPage'
import HostedKycPage from './pages/HostedKycPage'
import AnalyticsPage from './pages/desk/AnalyticsPage'
import AuditPage from './pages/desk/AuditPage'
import CaseDetailPage from './pages/desk/CaseDetailPage'
import CasesPage from './pages/desk/CasesPage'
import CustomerDetailPage from './pages/desk/CustomerDetailPage'
import CustomersPage from './pages/desk/CustomersPage'
import LoginPage from './pages/desk/LoginPage'
import SettingsPage from './pages/desk/SettingsPage'
import ToolsPage from './pages/desk/ToolsPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/kyc/:token" element={<HostedKycPage />} />
        <Route path="/desk/login" element={<LoginPage />} />

        <Route element={<RequireAuth />}>
          <Route path="/desk" element={<DeskShell />}>
            <Route index element={<Navigate to="cases" replace />} />
            <Route path="cases" element={<CasesPage />} />
            <Route path="cases/:id" element={<CaseDetailPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="customers/:id" element={<CustomerDetailPage />} />
            <Route path="tools" element={<ToolsPage />} />

            <Route element={<RequireAuth roles={['ADMIN']} />}>
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            <Route element={<RequireAuth roles={['ADMIN', 'COMPLIANCE']} />}>
              <Route path="audit" element={<AuditPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
