import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import type { AuditLog } from '../../api/types'
import { DataTable, type Column } from '../../components/desk/DataTable'
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Panel,
  Stamp,
  formatWhen,
  riskLabel,
} from '../../components/desk/ui'
import { usePagination } from '../../hooks/usePagination'

const PAGE_SIZE = 25

const actionLabels: Record<string, string> = {
  CASE_DECIDE: 'Case decided',
  CASE_OPEN: 'Case opened',
  KYC_CREATE: 'KYC check created',
  DOCUMENT_VERIFY: 'Document checked',
}

function entityLink(row: AuditLog) {
  if (row.entityType === 'Case') return `/desk/cases/${row.entityId}`
  if (row.entityType === 'Customer') return `/desk/customers/${row.entityId}`
  return null
}

export default function AuditPage() {
  const [rows, setRows] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const pager = usePagination(rows, PAGE_SIZE)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    api
      .get<AuditLog[]>('/api/audit')
      .then(setRows)
      .catch((err) => setError(err))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const columns: Column<AuditLog>[] = [
    {
      key: 'when',
      header: 'When',
      rowHeader: true,
      sortValue: (r) => r.createdAt,
      render: (r) => <span className="whitespace-nowrap font-mono text-xs tabular-nums text-content-muted">{formatWhen(r.createdAt)}</span>,
    },
    {
      key: 'action',
      header: 'Action',
      sortValue: (r) => r.action,
      render: (r) => {
        const decision = r.afterState && typeof r.afterState.decision === 'string' ? r.afterState.decision : null
        return (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span className="text-content">{actionLabels[r.action] ?? riskLabel(r.action)}</span>
            {decision && <Stamp value={decision} />}
          </span>
        )
      },
    },
    {
      key: 'entity',
      header: 'Record',
      render: (r) => {
        const to = entityLink(r)
        const text = (
          <>
            {r.entityType} <span className="font-mono text-xs">#{r.entityId}</span>
          </>
        )
        return to ? (
          <Link to={to} className="text-content hover:underline">
            {text}
          </Link>
        ) : (
          <span className="text-content-muted">{text}</span>
        )
      },
    },
    {
      key: 'user',
      header: 'By',
      align: 'right',
      hideOnMobile: true,
      render: (r) =>
        r.userId != null ? <span className="font-mono text-xs">user #{r.userId}</span> : <span className="text-content-subtle">System</span>,
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader title="Audit log" subtitle="Who did what, and when, for decisions and configuration changes." />
      <Panel>
        {error ? (
          <ErrorState error={error} onRetry={load} what="the audit log" />
        ) : (
          <>
            <DataTable
              caption="Audit log"
              rows={pager.slice}
              columns={columns}
              rowKey={(r) => r.id}
              loading={loading}
              empty={<EmptyState title="No audit events yet" body="Decisions and settings changes are recorded here." />}
            />
            {!loading && (
              <Pagination
                label="Audit pages"
                page={pager.page}
                totalPages={pager.totalPages}
                total={pager.total}
                from={pager.from}
                to={pager.to}
                onChange={pager.setPage}
              />
            )}
          </>
        )}
      </Panel>
    </div>
  )
}
