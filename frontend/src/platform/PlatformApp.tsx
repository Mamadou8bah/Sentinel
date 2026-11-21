import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { BrandMark } from '../components/desk/BrandMark'
import { DataTable, type Column } from '../components/desk/DataTable'
import { Field, Notice, PageHeader, Panel, PanelHeader, LoadingBlock, buttonClass, inputClass, formatWhen, useDocumentTitle } from '../components/desk/ui'
import { ThemeProvider, useTheme } from '../theme/ThemeContext'
import { PlatformAuth, PlatformGuard, usePlatformAuth } from './auth'
import { request, type PlatformSession, type Page, type Tenant, type TenantDetail, type Staff, type Summary, type Audit } from './api'
import { useAction, useRead } from './hooks'

const button = `${buttonClass('primary')} min-h-11`
const secondary = `${buttonClass('secondary')} min-h-11`
const danger = `${buttonClass('danger')} min-h-11`
const field = `${inputClass} min-h-11`
const link = 'font-medium text-accent underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent'
const reasonField = { minLength: 5, maxLength: 500, required: true }
const roles = ['ADMIN', 'COMPLIANCE', 'ANALYST'] as const
function Status({ enabled, disabledLabel = 'Suspended' }: { enabled: boolean; disabledLabel?: string }) { return <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium ${enabled ? 'text-risk-allow' : 'text-risk-block'}`}><span aria-hidden className="size-1.5 rounded-full bg-current" />{enabled ? 'Enabled' : disabledLabel}</span> }
function ErrorMessage({ message }: { message: string }) { return message ? <div role="alert"><Notice tone="error">{message}</Notice></div> : null }
function ReadState({ error, loading, reload, children }: { error: string; loading: boolean; reload: () => void; children: ReactNode }) {
  if (loading) return <LoadingBlock label="Loading platform data" />
  if (error) return <div className="space-y-3"><ErrorMessage message={error} /><button className={secondary} onClick={reload}>Try again</button></div>
  return <>{children}</>
}
function Secret({ label, value }: { label: string; value: string }) {
  const [message, setMessage] = useState('')
  return <div className="space-y-2"><Field label={label} hint="Shown once. Store it in the tenant's backend secret settings."><input aria-label={label} className={`${field} font-mono text-xs`} readOnly value={value} autoComplete="off" spellCheck={false} /></Field>
    <button type="button" className={secondary} onClick={() => { if (!navigator.clipboard) { setMessage('Select the value above to copy it.'); return } void navigator.clipboard.writeText(value).then(() => setMessage('Copied')).catch(() => setMessage('Select the value above to copy it.')) }}>Copy {label.toLowerCase()}</button><span role="status" className="ml-2 text-xs text-content-muted">{message}</span></div>
}
function PlatformLogin() {
  useDocumentTitle('Platform sign-in')
  const { session, setSession } = usePlatformAuth(), { theme } = useTheme(), location = useLocation(), navigate = useNavigate()
  const [username, setUsername] = useState(''), [password, setPassword] = useState(''), action = useAction()
  if (session) return <Navigate to="/platform" replace />
  const submit = (event: FormEvent) => { event.preventDefault(); void action.run(async () => {
    const next = await request<PlatformSession>('/auth/login', 'POST', { username: username.trim(), password })
    setPassword(''); setSession(next)
    const from = (location.state as { from?: string } | null)?.from
    navigate(from?.startsWith('/platform/') && from !== '/platform/login' ? from : '/platform', { replace: true })
  }) }
  return <div data-surface="desk" data-theme={theme} className="flex min-h-[100svh] items-center justify-center bg-surface-page px-4 py-10 text-content">
    <main className="w-full max-w-sm"><div className="mb-6 flex items-center gap-3 [&_img]:rounded-md [&_img]:bg-[#111827] [&_img]:p-1"><BrandMark size={30} /><span className="text-sm text-content-muted">Platform administration</span></div>
      <Panel><form onSubmit={submit} className="space-y-5 p-6"><div><h1 className="text-xl font-semibold">Sign in to Sentinel</h1><p className="mt-2 text-sm leading-6 text-content-muted">Manage tenants and platform access with your operator account.</p></div>
        <Field label="Username"><input className={field} autoComplete="username" autoCapitalize="none" required maxLength={64} value={username} onChange={e => setUsername(e.target.value)} /></Field>
        <Field label="Password"><input className={field} type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></Field>
        <ErrorMessage message={action.error} /><button className={`${button} w-full`} disabled={action.busy} aria-busy={action.busy}>{action.busy ? 'Signing in…' : 'Sign in'}</button>
      </form></Panel><p className="mt-5 text-center text-sm text-content-muted">Working for a tenant? <Link className={`${link} inline-flex min-h-11 items-center`} to="/desk/login">Staff sign-in</Link></p>
    </main></div>
}
const navigation = [{ to: '/platform', label: 'Overview', end: true }, { to: '/platform/tenants', label: 'Tenants' }, { to: '/platform/audit', label: 'Audit log' }, { to: '/platform/security', label: 'Security' }]
function Shell() {
  const { theme, toggleTheme } = useTheme(), { session, setSession } = usePlatformAuth(), location = useLocation(), main = useRef<HTMLElement>(null), [signingOut, setSigningOut] = useState(false)
  useEffect(() => { main.current?.focus({ preventScroll: true }) }, [location.pathname])
  return <div data-surface="desk" data-theme={theme} className="min-h-[100svh] bg-surface-page text-content">
    <a href="#platform-main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-surface focus:p-3">Skip to main content</a>
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 sm:px-6"><Link to="/platform" className="flex min-h-11 items-center gap-3 [&_img]:rounded-md [&_img]:bg-[#111827] [&_img]:p-1"><BrandMark size={28} /><span className="text-sm font-normal text-content-muted">Platform</span></Link>
      <div className="flex flex-wrap items-center gap-2"><span className="mr-2 max-w-40 truncate text-xs text-content-muted" title={session?.username}>{session?.username}</span><button className={secondary} onClick={toggleTheme}>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</button><button className={secondary} disabled={signingOut} onClick={() => { setSigningOut(true); void request('/auth/logout', 'POST').catch(() => undefined).finally(() => setSession(null)) }}>{signingOut ? 'Signing out…' : 'Sign out'}</button></div></header>
    <div className="mx-auto grid max-w-[1600px] md:grid-cols-[208px_minmax(0,1fr)]"><aside className="border-b border-line px-3 py-4 md:min-h-[calc(100svh-72px)] md:border-b-0 md:border-r md:py-6"><nav aria-label="Platform navigation" className="flex gap-1 overflow-x-auto md:flex-col">{navigation.map(item => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm ${isActive ? 'bg-surface-raised font-semibold text-content' : 'text-content-muted hover:bg-surface-raised hover:text-content'}`}>{item.label}</NavLink>)}</nav><p className="mt-8 hidden px-3 text-xs leading-5 text-content-subtle md:block">Tenant staff manage identity evidence and case decisions in their own desk.</p></aside>
      <main id="platform-main" ref={main} tabIndex={-1} className="min-w-0 space-y-6 p-4 outline-none [overflow-wrap:anywhere] sm:p-6 lg:p-8"><Outlet /></main></div>
  </div>
}
const tenantColumns: Column<Tenant>[] = [
  { key: 'name', header: 'Tenant', rowHeader: true, sortValue: t => t.name, render: t => <Link to={`/platform/tenants/${t.id}`} className={`${link} [overflow-wrap:anywhere]`}>{t.name}<span className="mt-1 block text-xs font-normal text-content-muted">{t.code}</span></Link> },
  { key: 'status', header: 'Access', render: t => <Status enabled={t.enabled} /> },
  { key: 'staff', header: 'Staff', align: 'right', render: t => t.staff.toLocaleString() },
  { key: 'customers', header: 'Customers', align: 'right', hideOnMobile: true, render: t => t.customers.toLocaleString() },
  { key: 'transactions', header: 'Transactions', align: 'right', hideOnMobile: true, render: t => t.transactions.toLocaleString() },
]
function Overview() {
  useDocumentTitle('Platform overview')
  const summary = useRead<Summary>('/summary'), tenants = useRead<Page<Tenant>>('/tenants?size=5')
  return <><PageHeader title="Platform overview" subtitle="Tenant access and activity across Sentinel." actions={<Link className={button} to="/platform/tenants/new">Create tenant</Link>} />
    <ReadState {...summary}>{summary.data && <Panel><dl className="grid grid-cols-2 gap-y-6 p-5 sm:grid-cols-3 xl:grid-cols-6">{[['Tenants', summary.data.tenants], ['Enabled', summary.data.enabledTenants], ['Staff', summary.data.staff], ['Customers', summary.data.customers], ['Transactions', summary.data.transactions], ['Cases', summary.data.cases]].map(([label, value]) => <div key={label} className="px-3"><dt className="text-xs text-content-muted">{label}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{Number(value).toLocaleString()}</dd></div>)}</dl></Panel>}</ReadState>
    <Panel><PanelHeader title="Recent tenants" actions={<Link to="/platform/tenants" className={link}>View all tenants</Link>} /><ReadState {...tenants}><DataTable rows={tenants.data?.items || []} columns={tenantColumns} rowKey={t => t.id} caption="Recent tenants" empty={<p className="p-6 text-sm text-content-muted">No tenants yet. Create a tenant to connect its backend.</p>} /></ReadState></Panel>
  </>
}
function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-sm text-content-muted"><span>{total.toLocaleString()} {total === 1 ? 'record' : 'records'}</span><div className="flex items-center gap-3"><button className={secondary} disabled={!page} onClick={() => onPage(page - 1)}>Previous</button><span>Page {page + 1}</span><button className={secondary} disabled={(page + 1) * 25 >= total} onClick={() => onPage(page + 1)}>Next</button></div></div>
}
function TenantList() {
  useDocumentTitle('Platform tenants')
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [page, setPage] = useState(0)
  useEffect(() => { const timer = setTimeout(() => { setQuery(search); setPage(0) }, 300); return () => clearTimeout(timer) }, [search])
  const data = useRead<Page<Tenant>>(`/tenants?q=${encodeURIComponent(query)}&page=${page}`)
  return <><PageHeader title="Tenants" subtitle="Manage each organisation's access to Sentinel." actions={<Link className={button} to="/platform/tenants/new">Create tenant</Link>} />
    <div className="max-w-sm"><Field label="Find a tenant"><input className={field} type="search" value={search} maxLength={100} placeholder="Search by name or code" onChange={e => setSearch(e.target.value)} /></Field></div>
    <ReadState {...data}><Panel><DataTable rows={data.data?.items || []} columns={tenantColumns} rowKey={t => t.id} caption="Tenants" empty={<p className="p-6 text-sm text-content-muted">No tenants match this search.</p>} /></Panel><Pagination page={page} total={data.data?.total || 0} onPage={setPage} /></ReadState></>
}
type Created = { tenantId: number; code: string; adminUsername: string; apiKey: string; webhookSigningSecret: string }
function CreateTenant() {
  useDocumentTitle('Create tenant')
  const action = useAction(), [created, setCreated] = useState<Created | null>(null)
  const [name, setName] = useState(''), [code, setCode] = useState(''), [username, setUsername] = useState(''), [password, setPassword] = useState(''), [url, setUrl] = useState(''), [reason, setReason] = useState('')
  if (created) return <div className="max-w-2xl space-y-5"><PageHeader title="Tenant created" subtitle={`${created.code} is ready. Its staff admin username is ${created.adminUsername}.`} /><Notice tone="info">Store these credentials now. They cannot be retrieved after leaving this page.</Notice><Secret label="Tenant API key" value={created.apiKey} /><Secret label="Webhook signing secret" value={created.webhookSigningSecret} /><Link className={button} to={`/platform/tenants/${created.tenantId}`}>Open tenant</Link></div>
  return <div className="max-w-2xl space-y-6"><PageHeader title="Create tenant" subtitle="Create the organisation, its first staff admin and integration credentials." /><form className="space-y-5" onSubmit={e => { e.preventDefault(); void action.run(async () => { const result = await request<Created>('/tenants', 'POST', { name, code, adminUsername: username, adminPassword: password, webhookUrl: url || null, reason }); setPassword(''); setCreated(result) }) }}>
    <Field label="Organisation name"><input className={field} required maxLength={200} value={name} onChange={e => setName(e.target.value)} /></Field>
    <Field label="Tenant code" hint="Lowercase letters, numbers and hyphens. Staff use this code to sign in."><input className={field} required pattern="[a-z0-9][a-z0-9-]{1,62}" maxLength={63} value={code} onChange={e => setCode(e.target.value)} autoCapitalize="none" spellCheck={false} /></Field>
    <div className="grid gap-5 sm:grid-cols-2"><Field label="Staff admin username"><input className={field} required pattern="[A-Za-z0-9._@-]{3,64}" maxLength={64} autoComplete="off" value={username} onChange={e => setUsername(e.target.value)} /></Field><Field label="Staff admin password" hint="At least 14 characters."><input className={field} type="password" minLength={14} maxLength={72} required autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></Field></div>
    <Field label="Webhook URL (optional)" hint="The tenant backend's HTTPS callback endpoint."><input className={field} type="url" maxLength={1024} value={url} placeholder="https://api.example.com/webhooks/sentinel" onChange={e => setUrl(e.target.value)} /></Field>
    <Field label="Reason"><textarea className={field} {...reasonField} value={reason} onChange={e => setReason(e.target.value)} /></Field><ErrorMessage message={action.error} /><div className="flex flex-wrap gap-3"><button className={button} disabled={action.busy}>{action.busy ? 'Creating tenant…' : 'Create tenant'}</button><Link className={secondary} to="/platform/tenants">Cancel</Link></div>
  </form></div>
}
function General({ tenant, reload }: { tenant: Tenant; reload: () => void }) {
  const [name, setName] = useState(tenant.name), [enabled, setEnabled] = useState(tenant.enabled), [url, setUrl] = useState(tenant.webhookUrl || ''), [reason, setReason] = useState(''), [confirmCode, setConfirmCode] = useState(''), action = useAction()
  return <div className="max-w-2xl space-y-8"><form className="space-y-5" onSubmit={e => { e.preventDefault(); void action.run(async () => { await request(`/tenants/${tenant.id}`, 'PUT', { name, enabled, webhookUrl: url || null, reason, confirmCode }); reload() }) }}>
    <Field label="Organisation name"><input className={field} required maxLength={200} value={name} onChange={e => setName(e.target.value)} /></Field>
    <Field label="Tenant access"><select aria-label="Tenant access" className={field} value={enabled ? 'enabled' : 'suspended'} onChange={e => setEnabled(e.target.value === 'enabled')}><option value="enabled">Enabled</option><option value="suspended">Suspended</option></select></Field>
    {tenant.enabled && !enabled && <><Notice tone="error">Suspending this tenant stops staff sign-ins and integration API access, including payment scoring.</Notice><Field label={`Type ${tenant.code} to confirm suspension`}><input className={field} required pattern={tenant.code} value={confirmCode} onChange={e => setConfirmCode(e.target.value)} autoComplete="off" /></Field></>}
    <Field label="Webhook URL (optional)"><input className={field} type="url" maxLength={1024} value={url} onChange={e => setUrl(e.target.value)} /></Field>
    <p className="text-sm text-content-muted">Signing secret: {tenant.webhookSecretConfigured ? 'Configured' : 'Not configured'}. Existing secrets are never displayed.</p>
    <Field label="Reason for change"><textarea className={field} {...reasonField} value={reason} onChange={e => setReason(e.target.value)} /></Field><ErrorMessage message={action.error} /><button className={!enabled && tenant.enabled ? danger : button} disabled={action.busy}>{action.busy ? 'Saving…' : !enabled && tenant.enabled ? 'Suspend tenant' : 'Save changes'}</button>
  </form><WebhookSecret tenantId={tenant.id} reload={reload} /></div>
}
function WebhookSecret({ tenantId, reload }: { tenantId: number; reload: () => void }) {
  const [confirming, setConfirming] = useState(false), [reason, setReason] = useState(''), [secret, setSecret] = useState(''), action = useAction()
  if (secret) return <div className="space-y-4 border-t border-line pt-6"><Secret label="New webhook signing secret" value={secret} /><button className={button} onClick={() => { setSecret(''); reload() }}>Done</button></div>
  return <div className="space-y-4 border-t border-line pt-6"><h2 className="font-semibold">Webhook signing secret</h2>{!confirming ? <button className={secondary} onClick={() => setConfirming(true)}>Rotate signing secret</button> : <form className="space-y-4" onSubmit={e => { e.preventDefault(); void action.run(async () => { const result = await request<{ webhookSigningSecret: string }>(`/tenants/${tenantId}/webhook-secret`, 'POST', { reason }); setSecret(result.webhookSigningSecret); setReason('') }) }}><Notice tone="error">The tenant backend must be updated with the replacement secret. Existing callback verification will stop working until both sides match.</Notice><Field label="Reason for secret rotation"><textarea className={field} {...reasonField} value={reason} onChange={e => setReason(e.target.value)} /></Field><ErrorMessage message={action.error} /><div className="flex flex-wrap gap-3"><button className={danger} disabled={action.busy}>{action.busy ? 'Rotating…' : 'Rotate signing secret'}</button><button type="button" className={secondary} onClick={() => setConfirming(false)} disabled={action.busy}>Cancel</button></div></form>}</div>
}
function StaffManager({ detail, reload }: { detail: TenantDetail; reload: () => void }) {
  const [target, setTarget] = useState<Staff | 'new' | null>(null)
  const columns: Column<Staff>[] = [{ key: 'username', header: 'Username', rowHeader: true, render: u => u.username }, { key: 'role', header: 'Role', render: u => u.role.charAt(0) + u.role.slice(1).toLowerCase() }, { key: 'status', header: 'Access', render: u => <Status enabled={u.enabled} /> }, { key: 'manage', header: <span className="sr-only">Manage staff</span>, align: 'right', render: u => <button className={secondary} onClick={() => setTarget(u)} aria-label={`Manage ${u.username}`}>Manage</button> }]
  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-content-muted">Staff can access only this tenant's desk.</p><button className={button} onClick={() => setTarget('new')}>Add staff</button></div>
    <Panel><DataTable rows={detail.staff} columns={columns} rowKey={u => u.id} caption="Tenant staff" /></Panel>
    {target && <StaffForm key={target === 'new' ? 'new' : target.id} tenantId={detail.tenant.id} target={target} onClose={() => setTarget(null)} reload={reload} />}</div>
}
function StaffForm({ tenantId, target, onClose, reload }: { tenantId: number; target: Staff | 'new'; onClose: () => void; reload: () => void }) {
  const existing = target === 'new' ? null : target, action = useAction()
  const [username, setUsername] = useState(existing?.username || ''), [password, setPassword] = useState(''), [role, setRole] = useState<Staff['role']>(existing?.role || 'ANALYST'), [enabled, setEnabled] = useState(existing?.enabled ?? true), [reason, setReason] = useState('')
  const submit = (e: FormEvent) => { e.preventDefault(); void action.run(async () => {
    if (existing) await request(`/tenants/${tenantId}/staff/${existing.id}`, 'PUT', { role, enabled, reason })
    else await request(`/tenants/${tenantId}/staff`, 'POST', { username, password, role, reason })
    setPassword(''); onClose(); reload()
  }) }
  return <Panel><div className="max-w-2xl space-y-5 p-5"><h2 className="font-semibold">{existing ? `Manage ${existing.username}` : 'Add staff account'}</h2><form className="space-y-5" onSubmit={submit}>
    {!existing && <><Field label="Username"><input className={field} required pattern="[A-Za-z0-9._@-]{3,64}" maxLength={64} value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" /></Field><Field label="Password" hint="At least 14 characters."><input className={field} required type="password" minLength={14} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" /></Field></>}
    <Field label="Role"><select aria-label="Role" className={field} value={role} onChange={e => setRole(e.target.value as Staff['role'])}>{roles.map(role => <option key={role} value={role}>{role.charAt(0) + role.slice(1).toLowerCase()}</option>)}</select></Field>
    {existing && <Field label="Access"><select aria-label="Access" className={field} value={enabled ? 'enabled' : 'suspended'} onChange={e => setEnabled(e.target.value === 'enabled')}><option value="enabled">Enabled</option><option value="suspended">Suspended</option></select></Field>}
    <Field label="Reason for change"><textarea className={field} {...reasonField} value={reason} onChange={e => setReason(e.target.value)} /></Field><ErrorMessage message={action.error} /><div className="flex flex-wrap gap-3"><button className={button} disabled={action.busy}>{action.busy ? 'Saving…' : existing ? 'Update access' : 'Create staff account'}</button><button type="button" className={secondary} onClick={onClose} disabled={action.busy}>Cancel</button></div>
  </form>{existing && <ResetStaffPassword tenantId={tenantId} user={existing} reload={reload} />}</div></Panel>
}
function ResetStaffPassword({ tenantId, user, reload }: { tenantId: number; user: Staff; reload: () => void }) {
  const [password, setPassword] = useState(''), [reason, setReason] = useState(''), action = useAction()
  return <form className="space-y-4 border-t border-line pt-5" onSubmit={e => { e.preventDefault(); void action.run(async () => { await request(`/tenants/${tenantId}/staff/${user.id}/password`, 'POST', { password, reason }); setPassword(''); reload() }) }}><h3 className="font-semibold">Reset staff password</h3><p className="text-sm text-content-muted">Previous sessions will be signed out.</p><Field label="New staff password"><input className={field} type="password" required minLength={14} maxLength={72} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></Field><Field label="Reason for password reset"><textarea className={field} {...reasonField} value={reason} onChange={e => setReason(e.target.value)} /></Field><ErrorMessage message={action.error} /><button className={secondary} disabled={action.busy}>{action.busy ? 'Resetting…' : 'Reset password'}</button></form>
}
function KeyManager({ detail, reload }: { detail: TenantDetail; reload: () => void }) {
  const [name, setName] = useState(''), [reason, setReason] = useState(''), [revealed, setRevealed] = useState(''), [revoke, setRevoke] = useState<number | null>(null), [revokeReason, setRevokeReason] = useState(''), action = useAction()
  if (revealed) return <div className="max-w-2xl space-y-5"><Notice tone="info">Save this API key in the tenant's backend. It will not be displayed again.</Notice><Secret label="New API key" value={revealed} /><button className={button} onClick={() => { setRevealed(''); reload() }}>Done</button></div>
  return <div className="space-y-6"><Panel><PanelHeader title="Integration keys" description="Only key prefixes are retained for display." /><DataTable rows={detail.keys} rowKey={k => k.id} caption="Tenant API keys" columns={[
    { key: 'name', header: 'Name', rowHeader: true, render: k => <span>{k.name}<span className="mt-1 block text-xs text-content-muted">{k.prefix}…</span></span> },
    { key: 'access', header: 'Access', render: k => <Status enabled={k.enabled} disabledLabel="Revoked" /> },
    { key: 'used', header: 'Last used', hideOnMobile: true, render: k => k.lastUsedAt ? formatWhen(k.lastUsedAt) : 'Not used' },
    { key: 'revoke', header: <span className="sr-only">Revoke key</span>, align: 'right', render: k => k.enabled ? <button className={secondary} onClick={() => { setRevoke(k.id); setRevokeReason('') }}>Revoke</button> : 'Revoked' },
  ]} empty={<p className="p-5 text-sm text-content-muted">No API keys have been issued.</p>} /></Panel>
    {revoke !== null && <form className="max-w-2xl space-y-4 rounded-xl border border-risk-block p-5" onSubmit={e => { e.preventDefault(); void action.run(async () => { await request(`/tenants/${detail.tenant.id}/keys/${revoke}/revoke`, 'POST', { reason: revokeReason }); setRevoke(null); reload() }) }}><h2 className="font-semibold">Revoke integration key?</h2><p className="text-sm text-content-muted">Backends using this key will lose access immediately. This cannot be undone.</p><Field label="Reason for revocation"><textarea className={field} {...reasonField} value={revokeReason} onChange={e => setRevokeReason(e.target.value)} /></Field><ErrorMessage message={action.error} /><div className="flex gap-3"><button className={danger} disabled={action.busy}>{action.busy ? 'Revoking…' : 'Revoke key'}</button><button type="button" className={secondary} disabled={action.busy} onClick={() => setRevoke(null)}>Cancel</button></div></form>}
    <form className="max-w-2xl space-y-4" onSubmit={e => { e.preventDefault(); void action.run(async () => { const result = await request<{ apiKey: string }>(`/tenants/${detail.tenant.id}/keys`, 'POST', { name, reason }); setRevealed(result.apiKey); setName(''); setReason('') }) }}><h2 className="font-semibold">Issue API key</h2><Field label="Key name"><input className={field} required maxLength={128} value={name} placeholder="e.g. Production payments" onChange={e => setName(e.target.value)} /></Field><Field label="Reason for issuing key"><textarea className={field} {...reasonField} value={reason} onChange={e => setReason(e.target.value)} /></Field><ErrorMessage message={action.error} /><button className={button} disabled={action.busy}>{action.busy ? 'Issuing…' : 'Issue API key'}</button></form>
  </div>
}
function TenantPage() {
  const { id } = useParams(), data = useRead<TenantDetail>(`/tenants/${encodeURIComponent(id || '')}`), [tab, setTab] = useState('General')
  useDocumentTitle(data.data?.tenant.name || 'Tenant')
  return <><Link className={`${link} inline-flex min-h-11 items-center text-sm`} to="/platform/tenants">Back to tenants</Link><ReadState {...data}>{data.data && <><PageHeader title={data.data.tenant.name} subtitle={`Tenant code: ${data.data.tenant.code}`} actions={<Status enabled={data.data.tenant.enabled} />} />
    <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">{[['Staff', data.data.tenant.staff], ['Customers', data.data.tenant.customers], ['Transactions', data.data.tenant.transactions], ['Cases', data.data.tenant.cases]].map(([label, value]) => <div key={label}><dt className="text-content-muted">{label}</dt><dd className="mt-1 font-semibold tabular-nums">{Number(value).toLocaleString()}</dd></div>)}</dl>
    <nav aria-label="Tenant sections" className="flex gap-1 overflow-x-auto border-b border-line">{['General', 'Staff', 'API keys'].map(label => <button key={label} aria-current={tab === label ? 'page' : undefined} className={`min-h-11 shrink-0 border-b-2 px-4 text-sm ${tab === label ? 'border-accent font-semibold text-content' : 'border-transparent text-content-muted'}`} onClick={() => setTab(label)}>{label}</button>)}</nav>
    {tab === 'General' && <General key={data.data.tenant.id} tenant={data.data.tenant} reload={data.reload} />}{tab === 'Staff' && <StaffManager detail={data.data} reload={data.reload} />}{tab === 'API keys' && <KeyManager detail={data.data} reload={data.reload} />}
  </>}</ReadState></>
}
function AuditLog() {
  useDocumentTitle('Platform audit log'); const [page, setPage] = useState(0), data = useRead<Page<Audit>>(`/audit?page=${page}`)
  return <><PageHeader title="Audit log" subtitle="Operator sign-ins and changes to platform access. Passwords and raw keys are never recorded." /><ReadState {...data}><Panel><DataTable rows={data.data?.items || []} rowKey={e => e.id} caption="Platform audit log" columns={[
    { key: 'action', header: 'Action', rowHeader: true, render: e => <div className="max-w-md"><span className="font-medium">{e.action.toLowerCase().replaceAll('_', ' ')}</span><p className="mt-1 break-words text-xs leading-5 text-content-muted">{e.detail}</p></div> },
    { key: 'actor', header: 'Operator', render: e => e.actor },
    { key: 'tenant', header: 'Tenant', hideOnMobile: true, render: e => e.tenantId ? <Link className={link} to={`/platform/tenants/${e.tenantId}`}>Tenant {e.tenantId}</Link> : 'Platform' },
    { key: 'date', header: 'When', hideOnMobile: true, render: e => formatWhen(e.createdAt) },
  ]} empty={<p className="p-5 text-sm text-content-muted">No operator events yet.</p>} /></Panel><Pagination page={page} total={data.data?.total || 0} onPage={setPage} /></ReadState></>
}
function Security() {
  useDocumentTitle('Platform security'); const { setSession } = usePlatformAuth(), action = useAction(), [currentPassword, setCurrent] = useState(''), [newPassword, setNew] = useState(''), [confirm, setConfirm] = useState(''), [message, setMessage] = useState('')
  return <div className="max-w-2xl space-y-6"><PageHeader title="Security" subtitle="Platform sessions expire automatically. Password changes sign out previous sessions." />
    <form className="space-y-5" onSubmit={e => { e.preventDefault(); setMessage(''); void action.run(async () => { if (newPassword !== confirm) throw new Error('New passwords do not match'); const session = await request<PlatformSession>('/auth/password', 'POST', { currentPassword, newPassword }); setSession(session); setCurrent(''); setNew(''); setConfirm(''); setMessage('Password changed. Previous sessions have been signed out.') }) }}>
      <Field label="Current password"><input className={field} type="password" required autoComplete="current-password" value={currentPassword} onChange={e => setCurrent(e.target.value)} /></Field><Field label="New password" hint="At least 14 characters."><input className={field} type="password" required minLength={14} maxLength={72} autoComplete="new-password" value={newPassword} onChange={e => setNew(e.target.value)} /></Field><Field label="Confirm new password"><input className={field} type="password" required minLength={14} maxLength={72} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></Field><ErrorMessage message={action.error} />{message && <Notice tone="info">{message}</Notice>}<button className={button} disabled={action.busy}>{action.busy ? 'Changing password…' : 'Change password'}</button>
    </form></div>
}
export default function PlatformApp() {
  return <ThemeProvider><PlatformAuth><Routes><Route path="login" element={<PlatformLogin />} /><Route element={<PlatformGuard />}><Route element={<Shell />}><Route index element={<Overview />} /><Route path="tenants" element={<TenantList />} /><Route path="tenants/new" element={<CreateTenant />} /><Route path="tenants/:id" element={<TenantPage />} /><Route path="audit" element={<AuditLog />} /><Route path="security" element={<Security />} /></Route></Route><Route path="*" element={<Navigate to="/platform" replace />} /></Routes></PlatformAuth></ThemeProvider>
}
