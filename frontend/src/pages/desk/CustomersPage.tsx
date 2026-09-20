import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import type { CustomerSummary } from '../../api/types'
import {
  EmptyState,
  LoadingBlock,
  PageHeader,
  Panel,
  RiskBar,
  StatusPill,
  kycTone,
} from '../../components/desk/ui'

export default function CustomersPage() {
  const [rows, setRows] = useState<CustomerSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<CustomerSummary[]>('/api/customers')
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load customers'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Bank clients"
        title="Customers"
        subtitle="Identity status and rolling risk for clients verified through your bank channels."
      />

      <Panel>
        {loading && <LoadingBlock />}
        {!loading && error && (
          <div className="px-6 py-10 text-center text-sm text-red-300">{error}</div>
        )}
        {!loading && !error && rows.length === 0 && (
          <EmptyState
            title="No customers yet"
            body="Customers appear after the bank completes a KYC session against Sentinel."
          />
        )}
        {!loading && !error && rows.length > 0 && (
          <ul className="divide-y divide-white/10">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  to={`/desk/customers/${row.id}`}
                  className="flex flex-col gap-4 px-5 py-5 transition hover:bg-white/[0.03] sm:flex-row sm:items-center sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-xl font-bold">{row.name}</p>
                      <StatusPill tone={kycTone(row.kycStatus)}>{row.kycStatus}</StatusPill>
                      {row.hasSignatureSpecimen && (
                        <StatusPill tone="neutral">Specimen</StatusPill>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-mute">{row.externalCustomerId || '—'}</p>
                  </div>
                  <RiskBar score={row.riskScore} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
