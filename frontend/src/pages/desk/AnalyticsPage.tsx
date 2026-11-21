import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { FraudTrend } from '../../api/types'
import {
  ErrorState,
  PageHeader,
  Panel,
  PanelHeader,
  SkeletonRows,
  ToneMarker,
  riskLabel,
  riskTone,
  type RiskTone,
} from '../../components/desk/ui'

const barTone: Record<RiskTone, string> = {
  allow: 'bg-risk-allow',
  review: 'bg-risk-review',
  block: 'bg-risk-block',
  pending: 'bg-risk-pending',
  muted: 'bg-content-subtle',
}

type Part = { key: string; label: string; value: number; tone: RiskTone }

/** One stacked bar with a labelled table beneath it; values are always written as text. */
function StackedBar({ parts, caption }: { parts: Part[]; caption: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  return (
    <div className="space-y-3 p-4">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-sm bg-surface-raised" aria-hidden>
        {total > 0 &&
          parts
            .filter((p) => p.value > 0)
            .map((p) => (
              <span key={p.key} className={barTone[p.tone]} style={{ width: `${(p.value / total) * 100}%` }} />
            ))}
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Status</th>
            <th scope="col">Count</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {parts.map((p) => (
            <tr key={p.key} className="border-b border-line last:border-b-0">
              <th scope="row" className="py-2 text-left font-normal">
                <span className="inline-flex items-center gap-2 text-content">
                  <ToneMarker tone={p.tone} />
                  {p.label}
                </span>
              </th>
              <td className="py-2 text-right font-mono tabular-nums text-content">{p.value}</td>
              <td className="w-16 py-2 text-right font-mono text-xs tabular-nums text-content-subtle">
                {total > 0 ? `${Math.round((p.value / total) * 100)}%` : '–'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AnalyticsPage() {
  const [trend, setTrend] = useState<FraudTrend | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    api
      .get<FraudTrend>('/api/admin/analytics/fraud-trend')
      .then(setTrend)
      .catch((err) => setError(err))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const header = <PageHeader title="Analytics" subtitle="Tenant-wide volume and how the case queue is moving." />

  if (loading || error || !trend) {
    return (
      <div className="space-y-5">
        {header}
        <Panel>
          {error ? <ErrorState error={error} onRetry={load} what="analytics" /> : <SkeletonRows rows={5} label="Loading analytics" />}
        </Panel>
      </div>
    )
  }

  const flaggedShare = trend.transactions > 0 ? Math.round((trend.flaggedTransactions / trend.transactions) * 100) : 0
  const caseParts: Part[] = [
    { key: 'open', label: 'Open', value: trend.casesOpen, tone: 'pending' },
    { key: 'review', label: 'Under review', value: trend.casesUnderReview, tone: 'review' },
    { key: 'resolved', label: 'Resolved', value: trend.casesResolved, tone: 'muted' },
  ]
  const kycOrder = ['VERIFIED', 'PENDING', 'FLAGGED', 'REJECTED']
  const rank = (s: string) => (kycOrder.indexOf(s) < 0 ? 99 : kycOrder.indexOf(s))
  const kycEntries = Object.entries(trend.customersByKycStatus || {}).sort((a, b) => rank(a[0]) - rank(b[0]))
  const kycParts: Part[] = kycEntries.map(([status, count]) => ({
    key: status,
    label: riskLabel(status),
    value: count,
    tone: riskTone(status),
  }))

  return (
    <div className="space-y-5">
      {header}

      <Panel labelledBy="volume">
        <PanelHeader id="volume" title="Volume" />
        <dl className="grid grid-cols-2 sm:grid-cols-4 sm:divide-x sm:divide-line">
          {[
            { label: 'Customers', value: String(trend.customers) },
            { label: 'Documents checked', value: String(trend.documents) },
            { label: 'Payments scored', value: String(trend.transactions) },
            { label: 'Payments flagged', value: `${trend.flaggedTransactions}`, note: `${flaggedShare}% of scored` },
          ].map((s) => (
            <div key={s.label} className="px-4 py-3">
              <dt className="text-xs text-content-muted">{s.label}</dt>
              <dd className="mt-1 font-mono text-[28px] font-medium leading-8 tabular-nums text-content">{s.value}</dd>
              {s.note && <dd className="text-xs text-content-subtle">{s.note}</dd>}
            </div>
          ))}
        </dl>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel labelledBy="case-flow">
          <PanelHeader id="case-flow" title="Case queue" description={`${trend.casesTotal} cases in total`} />
          <StackedBar parts={caseParts} caption="Cases by status" />
        </Panel>
        <Panel labelledBy="kyc-mix">
          <PanelHeader id="kyc-mix" title="KYC outcomes" description="Customers by identity status" />
          {kycParts.length === 0 ? (
            <p className="p-4 text-sm text-content-muted">No KYC outcomes yet.</p>
          ) : (
            <StackedBar parts={kycParts} caption="Customers by KYC status" />
          )}
        </Panel>
      </div>
    </div>
  )
}
