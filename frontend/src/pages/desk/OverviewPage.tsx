import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import type { CaseResponse, CustomerSummary, FraudTrend } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import {
  LoadingBlock,
  PageHeader,
  Panel,
  RiskBar,
  StatusPill,
  caseTone,
  formatWhen,
  kycTone,
} from '../../components/desk/ui'

function EmberCta({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-3 rounded-full bg-ember-grad px-6 py-3.5 text-sm font-semibold text-white transition hover:scale-[1.02] active:scale-[0.98]"
    >
      {children}
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
    </Link>
  )
}

export default function OverviewPage() {
  const { hasRole, session } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cases, setCases] = useState<CaseResponse[]>([])
  const [customers, setCustomers] = useState<CustomerSummary[]>([])
  const [trend, setTrend] = useState<FraudTrend | null>(null)

  useEffect(() => {
    setLoading(true)
    const tasks: Promise<unknown>[] = [
      api.get<CaseResponse[]>('/api/cases').then(setCases),
      api.get<CustomerSummary[]>('/api/customers').then(setCustomers),
    ]
    if (hasRole('ADMIN')) {
      tasks.push(api.get<FraudTrend>('/api/admin/analytics/fraud-trend').then(setTrend))
    }
    Promise.all(tasks)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load overview'))
      .finally(() => setLoading(false))
  }, [hasRole])

  if (loading) return <LoadingBlock label="Loading overview…" />
  if (error) return <div className="text-sm text-[color:var(--status-danger)]">{error}</div>

  const openCases = cases.filter((c) => c.status === 'OPEN')
  const reviewCases = cases.filter((c) => c.status === 'UNDER_REVIEW')
  const flaggedCustomers = customers.filter(
    (c) => c.kycStatus === 'FLAGGED' || c.kycStatus === 'REJECTED',
  )
  const recentCases = [...cases]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6)
  const topRisk = [...customers].sort((a, b) => b.riskScore - a.riskScore).slice(0, 5)

  const stats = [
    { label: 'Open cases', value: openCases.length, to: '/desk/cases' },
    { label: 'Under review', value: reviewCases.length, to: '/desk/cases' },
    { label: 'Customers', value: customers.length, to: '/desk/customers' },
    { label: 'Flagged KYC', value: flaggedCustomers.length, to: '/desk/customers' },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Staff desk"
        title={
          <>
            Welcome, {session?.username ?? 'officer'}
            <span className="mt-1 block text-ember-glow">Review what automation flags.</span>
          </>
        }
        subtitle="Queue pressure, high-risk customers, and recent case activity — same Sentinel look your bank already trusts."
        actions={<EmberCta to="/desk/cases">Open case queue</EmberCta>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} to={stat.to} className="block transition hover:scale-[1.01]">
            <Panel className="p-5 sm:p-6">
              <p className="text-xs uppercase tracking-[0.14em] text-fg/55">{stat.label}</p>
              <p className="mt-3 font-display text-4xl font-black text-fg">{stat.value}</p>
            </Panel>
          </Link>
        ))}
      </div>

      {trend && hasRole('ADMIN') && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Documents', value: trend.documents },
            { label: 'Transactions', value: trend.transactions },
            { label: 'Flagged TX', value: trend.flaggedTransactions },
            { label: 'Cases total', value: trend.casesTotal },
          ].map((card) => (
            <Panel key={card.label} className="p-5">
              <p className="text-xs uppercase tracking-[0.14em] text-fg/55">{card.label}</p>
              <p className="mt-3 font-display text-3xl font-bold">{card.value}</p>
            </Panel>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-5">
        <Panel className="overflow-hidden lg:col-span-3">
          <div className="flex items-center justify-between border-b border-fg/10 px-5 py-4 sm:px-6">
            <h2 className="font-display text-xl font-bold sm:text-2xl">Recent cases</h2>
            <Link to="/desk/cases" className="text-sm text-ember-glow hover:underline">
              View all
            </Link>
          </div>
          {recentCases.length === 0 ? (
            <p className="px-5 py-10 text-sm text-mute">No cases yet.</p>
          ) : (
            <ul className="divide-y divide-fg/10">
              {recentCases.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`/desk/cases/${item.id}`}
                    className="flex flex-col gap-3 px-5 py-4 transition hover:bg-fg/[0.04] sm:flex-row sm:items-center sm:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-lg font-bold">{item.customerName}</p>
                        <StatusPill tone={caseTone(item.status)}>
                          {item.status.replace(/_/g, ' ')}
                        </StatusPill>
                      </div>
                      <p className="mt-1 line-clamp-1 text-sm text-mute">{item.explanation}</p>
                      <p className="mt-1 text-xs text-fg/40">{formatWhen(item.updatedAt)}</p>
                    </div>
                    <RiskBar score={item.riskScoreAtCreation} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-fg/10 px-5 py-4 sm:px-6">
            <h2 className="font-display text-xl font-bold sm:text-2xl">Highest risk</h2>
            <Link to="/desk/customers" className="text-sm text-ember-glow hover:underline">
              Customers
            </Link>
          </div>
          {topRisk.length === 0 ? (
            <p className="px-5 py-10 text-sm text-mute">No customers yet.</p>
          ) : (
            <ul className="divide-y divide-fg/10">
              {topRisk.map((row) => (
                <li key={row.id}>
                  <Link
                    to={`/desk/customers/${row.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-fg/[0.04] sm:px-6"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-fg">{row.name}</p>
                      <div className="mt-1">
                        <StatusPill tone={kycTone(row.kycStatus)}>{row.kycStatus}</StatusPill>
                      </div>
                    </div>
                    <RiskBar score={row.riskScore} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { to: '/desk/tools', title: 'Desk tools', body: 'Score a payment, verify a document, or import CSV.' },
          { to: '/desk/cases', title: 'Work the queue', body: 'Filter by status and decide with mandatory notes.' },
          {
            to: hasRole('ADMIN') ? '/desk/analytics' : '/desk/customers',
            title: hasRole('ADMIN') ? 'Analytics' : 'Customer 360°',
            body: hasRole('ADMIN')
              ? 'Tenant volume, KYC mix, and fraud pressure.'
              : 'Identity scores, documents, and payment history.',
          },
        ].map((card) => (
          <Link
            key={card.to + card.title}
            to={card.to}
            className="liquid-glass block rounded-[28px] p-6 transition hover:scale-[1.01]"
          >
            <p className="font-display text-xl font-bold">{card.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-mute">{card.body}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
