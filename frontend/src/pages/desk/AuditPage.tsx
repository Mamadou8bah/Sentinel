import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { AuditLog } from '../../api/types'
import {
  EmptyState,
  LoadingBlock,
  PageHeader,
  Panel,
  formatWhen,
} from '../../components/desk/ui'

export default function AuditPage() {
  const [rows, setRows] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<AuditLog[]>('/api/audit')
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load audit'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Compliance"
        title="Audit trail"
        subtitle="Immutable who / what / when for decisions and configuration changes."
      />

      <Panel>
        {loading && <LoadingBlock />}
        {!loading && error && (
          <div className="px-6 py-10 text-center text-sm text-red-300">{error}</div>
        )}
        {!loading && !error && rows.length === 0 && (
          <EmptyState title="No audit events" body="Actions will appear here as staff work the desk." />
        )}
        {!loading && !error && rows.length > 0 && (
          <ul className="divide-y divide-white/10">
            {rows.map((row) => (
              <li key={row.id} className="px-5 py-5 sm:px-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-display text-lg font-bold text-white">{row.action}</p>
                  <p className="text-xs text-white/40">{formatWhen(row.createdAt)}</p>
                </div>
                <p className="mt-1 text-sm text-mute">
                  {row.entityType} · {row.entityId}
                  {row.userId != null ? ` · user #${row.userId}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
