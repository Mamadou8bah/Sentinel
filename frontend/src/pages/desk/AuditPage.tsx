import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { AuditLog } from '../../api/types'
import {
  EmptyState,
  LoadingBlock,
  PageHeader,
  Pagination,
  Panel,
  formatWhen,
} from '../../components/desk/ui'
import { usePagination } from '../../hooks/usePagination'

const PAGE_SIZE = 8

export default function AuditPage() {
  const [rows, setRows] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pager = usePagination(rows, PAGE_SIZE)

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
          <div className="px-6 py-10 text-center text-sm text-red-500 dark:text-[color:var(--status-danger)]">{error}</div>
        )}
        {!loading && !error && rows.length === 0 && (
          <EmptyState title="No audit events" body="Actions will appear here as staff work the desk." />
        )}
        {!loading && !error && rows.length > 0 && (
          <>
            <ul className="divide-y divide-fg/10">
              {pager.slice.map((row) => (
                <li key={row.id} className="px-5 py-5 sm:px-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-display text-lg font-bold text-fg">{row.action}</p>
                    <p className="text-xs text-fg/40">{formatWhen(row.createdAt)}</p>
                  </div>
                  <p className="mt-1 text-sm text-mute">
                    {row.entityType} · {row.entityId}
                    {row.userId != null ? ` · user #${row.userId}` : ''}
                  </p>
                </li>
              ))}
            </ul>
            <Pagination
              page={pager.page}
              totalPages={pager.totalPages}
              total={pager.total}
              from={pager.from}
              to={pager.to}
              onChange={pager.setPage}
            />
          </>
        )}
      </Panel>
    </div>
  )
}
