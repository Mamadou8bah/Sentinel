import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { FraudTrend } from '../../api/types'
import { LoadingBlock, PageHeader, Panel } from '../../components/desk/ui'

export default function AnalyticsPage() {
  const [trend, setTrend] = useState<FraudTrend | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<FraudTrend>('/api/admin/analytics/fraud-trend')
      .then(setTrend)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingBlock label="Loading analytics…" />
  if (error || !trend) {
    return <div className="text-sm text-red-300">{error || 'No analytics'}</div>
  }

  const cards = [
    { label: 'Customers', value: trend.customers },
    { label: 'Documents', value: trend.documents },
    { label: 'Transactions', value: trend.transactions },
    { label: 'Flagged TX', value: trend.flaggedTransactions },
    { label: 'Cases open', value: trend.casesOpen },
    { label: 'Under review', value: trend.casesUnderReview },
    { label: 'Resolved', value: trend.casesResolved },
    { label: 'Cases total', value: trend.casesTotal },
  ]

  const kycEntries = Object.entries(trend.customersByKycStatus || {})

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Fraud trends"
        subtitle="Tenant-wide volume and queue pressure for the compliance desk."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Panel key={card.label} className="p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-white/45">{card.label}</p>
            <p className="mt-3 font-display text-4xl font-black">{card.value}</p>
          </Panel>
        ))}
      </div>

      <Panel className="p-6 md:p-8">
        <h2 className="font-display text-2xl font-bold">KYC mix</h2>
        {kycEntries.length === 0 ? (
          <p className="mt-4 text-sm text-mute">No KYC outcomes yet.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {kycEntries.map(([status, count]) => (
              <li
                key={status}
                className="flex items-center justify-between border-b border-white/10 pb-3 text-sm"
              >
                <span className="text-mute">{status}</span>
                <span className="font-display text-xl font-bold text-white">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
