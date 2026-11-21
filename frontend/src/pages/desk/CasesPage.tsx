import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import type { CaseResponse, CaseStatus } from '../../api/types'
import { DataTable, type Column, type SortState } from '../../components/desk/DataTable'
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Panel,
  Score,
  Segmented,
  Stamp,
  Status,
  buttonClass,
  formatWhen,
} from '../../components/desk/ui'
import { useCaseEvents, type LiveState } from '../../hooks/useCaseEvents'
import { usePagination } from '../../hooks/usePagination'

type StatusFilter = CaseStatus | 'ALL'
const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'OPEN', label: 'Open' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'ALL', label: 'All' },
]
const PAGE_SIZE = 25

function isStatus(v: string | null): v is StatusFilter {
  return v === 'ALL' || v === 'OPEN' || v === 'UNDER_REVIEW' || v === 'RESOLVED'
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

function LiveIndicator({ state, lastEventAt }: { state: LiveState; lastEventAt: number | null }) {
  const now = useNow(5000)
  const ago = lastEventAt ? Math.max(0, Math.round((now - lastEventAt) / 1000)) : null
  const copy: Record<LiveState, string> = {
    live: ago != null ? `Live · last update ${ago < 60 ? `${ago}s` : `${Math.round(ago / 60)}m`} ago` : 'Live',
    connecting: 'Connecting to live updates…',
    reconnecting: 'Live updates paused · reconnecting',
    demo: 'Demo data · live updates off',
    off: 'Live updates off',
  }
  const dot =
    state === 'live'
      ? 'bg-risk-allow s-live-dot'
      : state === 'reconnecting'
        ? 'bg-risk-review'
        : 'border border-content-subtle'
  return (
    <span role="status" className="inline-flex items-center gap-2 text-xs text-content-muted">
      <span className={`inline-block h-2 w-2 rounded-full ${dot}`} aria-hidden />
      {copy[state]}
    </span>
  )
}

export default function CasesPage() {
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('status')
  const status: StatusFilter = isStatus(statusParam) ? statusParam : 'OPEN'
  const sortKey: 'risk' | 'date' = params.get('sort') === 'date' ? 'date' : 'risk'

  const [cases, setCases] = useState<CaseResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const pager = usePagination(cases, PAGE_SIZE)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams({ sort: sortKey })
      if (status !== 'ALL') query.set('status', status)
      const data = await api.get<CaseResponse[]>(`/api/cases?${query}`)
      setCases(data)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [status, sortKey])

  useEffect(() => {
    void load()
  }, [load])

  const live = useCaseEvents(() => {
    void load()
  })

  function update(next: { status?: StatusFilter; sort?: 'risk' | 'date' }) {
    const p = new URLSearchParams(params)
    if (next.status) p.set('status', next.status)
    if (next.sort) p.set('sort', next.sort)
    setParams(p, { replace: true })
  }

  // Server-side sort: risk (highest first) or date (newest first).
  const sort: SortState = { key: sortKey === 'risk' ? 'risk' : 'opened', dir: 'desc' }

  const columns: Column<CaseResponse>[] = [
    {
      key: 'id',
      header: 'Case',
      hideOnMobile: true,
      render: (c) => <span className="font-mono text-xs text-content-subtle">#{c.id}</span>,
    },
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
    {
      key: 'status',
      header: 'Status',
      render: (c) =>
        c.decision ? (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <Status value={c.status} />
            <Stamp value={c.decision} />
          </span>
        ) : (
          <Status value={c.status} />
        ),
    },
    {
      key: 'reason',
      header: 'Reason',
      hideOnMobile: true,
      render: (c) => <span className="line-clamp-1 max-w-[32rem] text-content-muted">{c.explanation}</span>,
    },
    {
      key: 'opened',
      header: 'Opened',
      hideOnMobile: true,
      sortable: true,
      render: (c) => <span className="whitespace-nowrap text-xs tabular-nums text-content-subtle">{formatWhen(c.createdAt)}</span>,
    },
    {
      key: 'risk',
      header: 'Risk',
      align: 'right',
      sortable: true,
      render: (c) => <Score score={c.riskScoreAtCreation} />,
    },
  ]

  const filtered = status !== 'ALL'
  const statusName = statusOptions.find((o) => o.value === status)?.label.toLowerCase()

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cases"
        subtitle="KYC checks, documents and payments that automation could not clear."
        actions={<LiveIndicator state={live.state} lastEventAt={live.lastEventAt} />}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Segmented label="Case status" value={status} options={statusOptions} onChange={(v) => update({ status: v })} />
        <p className="text-xs text-content-subtle">
          Sorted by {sortKey === 'risk' ? 'risk, highest first' : 'date opened, newest first'}
        </p>
      </div>

      <Panel>
        {error ? (
          <ErrorState error={error} onRetry={() => void load()} what="cases" />
        ) : (
          <>
            <DataTable
              caption="Case queue"
              rows={pager.slice}
              columns={columns}
              rowKey={(c) => c.id}
              loading={loading}
              sort={sort}
              onSortChange={(s) => update({ sort: s?.key === 'opened' ? 'date' : 'risk' })}
              empty={
                filtered && status !== 'OPEN' ? (
                  <EmptyState
                    title={`No ${statusName} cases`}
                    body="Try another status."
                    action={
                      <button type="button" className={buttonClass('secondary')} onClick={() => update({ status: 'ALL' })}>
                        Show all cases
                      </button>
                    }
                  />
                ) : (
                  <EmptyState
                    title={status === 'OPEN' ? 'No open cases' : 'No cases yet'}
                    body="Cases are opened when a KYC check, document or payment needs a person to decide."
                  />
                )
              }
            />
            {!loading && (
              <Pagination
                label="Case pages"
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
