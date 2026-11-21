import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import type { CaseResponse, CustomerSummary, FraudTrend } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { DataTable, type Column } from '../../components/desk/DataTable'
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Panel,
  PanelHeader,
  Score,
  SkeletonRows,
  Status,
  buttonClass,
  formatWhen,
} from '../../components/desk/ui'

type Kpi = { label: string; value: number; to: string; note: string }

function KpiTile({ kpi }: { kpi: Kpi }) {
  return (
    <Link
      to={kpi.to}
      className="group block rounded-xl border border-line bg-surface p-4 shadow-surface transition-colors hover:border-line-strong"
    >
      <p className="text-xs font-medium text-content-muted">{kpi.label}</p>
      <p className="mt-2 font-mono text-[28px] font-medium leading-8 tabular-nums text-content">{kpi.value}</p>
      <p className="mt-1 text-xs text-content-subtle group-hover:text-content-muted">{kpi.note}</p>
    </Link>
  )
}

export default function OverviewPage() {
  const { hasRole } = useAuth()
  const isAdmin = hasRole('ADMIN')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [cases, setCases] = useState<CaseResponse[]>([])
  const [customers, setCustomers] = useState<CustomerSummary[]>([])
  const [trend, setTrend] = useState<FraudTrend | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    const tasks: Promise<unknown>[] = [
      api.get<CaseResponse[]>('/api/cases').then(setCases),
      api.get<CustomerSummary[]>('/api/customers').then(setCustomers),
    ]
    if (isAdmin) {
      tasks.push(api.get<FraudTrend>('/api/admin/analytics/fraud-trend').then(setTrend))
    }
    Promise.all(tasks)
      .catch((err) => setError(err))
      .finally(() => setLoading(false))
  }, [isAdmin])

  useEffect(() => {
    load()
  }, [load])

  const openCases = cases.filter((c) => c.status === 'OPEN')
  const reviewCases = cases.filter((c) => c.status === 'UNDER_REVIEW')
  const flaggedCustomers = customers.filter((c) => c.kycStatus === 'FLAGGED')
  const highRisk = customers.filter((c) => c.riskScore >= 70)
  const needsDecision = [...openCases, ...reviewCases]
    .sort((a, b) => b.riskScoreAtCreation - a.riskScoreAtCreation)
    .slice(0, 8)
  const topRisk = [...customers].sort((a, b) => b.riskScore - a.riskScore).slice(0, 6)

  const kpis: Kpi[] = [
    { label: 'Open cases', value: openCases.length, to: '/desk/cases?status=OPEN', note: 'Waiting for a first decision' },
    { label: 'Under review', value: reviewCases.length, to: '/desk/cases?status=UNDER_REVIEW', note: 'Escalated, not yet resolved' },
    { label: 'Flagged KYC', value: flaggedCustomers.length, to: '/desk/customers?kyc=FLAGGED', note: 'Identity checks needing review' },
    { label: 'High-risk customers', value: highRisk.length, to: '/desk/customers?risk=high', note: 'Risk score 70 or above' },
  ]

  const caseColumns: Column<CaseResponse>[] = [
    {
      key: 'customer',
      header: 'Customer',
      rowHeader: true,
      render: (c) => (
        <Link to={`/desk/cases/${c.id}`} className="font-medium text-content hover:underline">
          {c.customerName}
        </Link>
      ),
    },
    { key: 'status', header: 'Status', render: (c) => <Status value={c.status} /> },
    {
      key: 'reason',
      header: 'Reason',
      hideOnMobile: true,
      render: (c) => <span className="line-clamp-1 max-w-[28rem] text-content-muted">{c.explanation}</span>,
    },
    {
      key: 'opened',
      header: 'Opened',
      hideOnMobile: true,
      render: (c) => <span className="whitespace-nowrap text-xs text-content-subtle">{formatWhen(c.createdAt)}</span>,
    },
    { key: 'risk', header: 'Risk', align: 'right', render: (c) => <Score score={c.riskScoreAtCreation} showBar={false} /> },
  ]

  const customerColumns: Column<CustomerSummary>[] = [
    {
      key: 'name',
      header: 'Customer',
      rowHeader: true,
      render: (c) => (
        <Link to={`/desk/customers/${c.id}`} className="font-medium text-content hover:underline">
          {c.name}
        </Link>
      ),
    },
    { key: 'kyc', header: 'KYC', render: (c) => <Status value={c.kycStatus} /> },
    { key: 'risk', header: 'Risk', align: 'right', render: (c) => <Score score={c.riskScore} showBar={false} /> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        subtitle="What needs a decision now. Each figure opens the matching list."
        actions={
          <Link to="/desk/cases?status=OPEN" className={buttonClass('primary')}>
            Work the queue
          </Link>
        }
      />

      {error ? (
        <Panel>
          <ErrorState error={error} onRetry={load} what="the overview" />
        </Panel>
      ) : (
        <>
          <section aria-label="Exceptions" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {loading
              ? Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="h-[106px] rounded-xl border border-line bg-surface p-4" aria-hidden>
                    <span className="s-shimmer block h-3 w-24 rounded bg-surface-raised" />
                    <span className="s-shimmer mt-3 block h-7 w-12 rounded bg-surface-raised" />
                  </div>
                ))
              : kpis.map((k) => <KpiTile key={k.label} kpi={k} />)}
          </section>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Panel labelledBy="needs-decision">
              <PanelHeader
                id="needs-decision"
                title="Needs a decision"
                description="Open and escalated cases, highest risk first"
                actions={
                  <Link to="/desk/cases" className="text-sm font-medium text-accent-ink hover:underline">
                    All cases
                  </Link>
                }
              />
              {loading ? (
                <SkeletonRows rows={5} label="Loading cases" />
              ) : (
                <DataTable
                  caption="Cases that need a decision"
                  rows={needsDecision}
                  columns={caseColumns}
                  rowKey={(c) => c.id}
                  empty={<EmptyState title="Nothing waiting" body="No open or escalated cases right now." />}
                />
              )}
            </Panel>

            <Panel labelledBy="highest-risk">
              <PanelHeader
                id="highest-risk"
                title="Highest-risk customers"
                actions={
                  <Link to="/desk/customers" className="text-sm font-medium text-accent-ink hover:underline">
                    All customers
                  </Link>
                }
              />
              {loading ? (
                <SkeletonRows rows={5} label="Loading customers" />
              ) : (
                <DataTable
                  caption="Highest-risk customers"
                  rows={topRisk}
                  columns={customerColumns}
                  rowKey={(c) => c.id}
                  empty={<EmptyState title="No customers yet" body="Customers appear after a bank completes a KYC session." />}
                />
              )}
            </Panel>
          </div>

          {isAdmin && trend && (
            <Panel labelledBy="volume">
              <PanelHeader
                id="volume"
                title="Tenant volume"
                actions={
                  <Link to="/desk/analytics" className="text-sm font-medium text-accent-ink hover:underline">
                    Analytics
                  </Link>
                }
              />
              <dl className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
                {[
                  { label: 'Documents checked', value: trend.documents },
                  { label: 'Payments scored', value: trend.transactions },
                  { label: 'Payments flagged', value: trend.flaggedTransactions },
                  { label: 'Cases, all time', value: trend.casesTotal },
                ].map((s) => (
                  <div key={s.label} className="px-4 py-3">
                    <dt className="text-xs text-content-muted">{s.label}</dt>
                    <dd className="mt-1 font-mono text-lg tabular-nums text-content">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          )}
        </>
      )}
    </div>
  )
}
