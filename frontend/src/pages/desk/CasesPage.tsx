import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import type { CaseResponse, CaseStatus } from '../../api/types'
import {
  EmptyState,
  LoadingBlock,
  PageHeader,
  Panel,
  RiskBar,
  StatusPill,
  caseTone,
  formatWhen,
} from '../../components/desk/ui'
import { useCaseEvents } from '../../hooks/useCaseEvents'

const statuses: Array<CaseStatus | 'ALL'> = ['ALL', 'OPEN', 'UNDER_REVIEW', 'RESOLVED']

export default function CasesPage() {
  const [status, setStatus] = useState<CaseStatus | 'ALL'>('OPEN')
  const [sort, setSort] = useState<'risk' | 'date'>('risk')
  const [cases, setCases] = useState<CaseResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [liveNote, setLiveNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ sort })
      if (status !== 'ALL') params.set('status', status)
      const data = await api.get<CaseResponse[]>(`/api/cases?${params}`)
      setCases(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cases')
    } finally {
      setLoading(false)
    }
  }, [status, sort])

  useEffect(() => {
    void load()
  }, [load])

  useCaseEvents((message) => {
    setLiveNote(`${message.event.replaceAll('_', ' ')} · just now`)
    void load()
  })

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Compliance"
        title="Case queue"
        subtitle="Flagged KYC, documents, and payments that need a human decision."
        actions={
          liveNote ? (
            <StatusPill tone="ember">{liveNote}</StatusPill>
          ) : (
            <StatusPill tone="neutral">Live</StatusPill>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {statuses.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setStatus(item)}
            className={[
              'rounded-full px-4 py-2 text-sm transition',
              status === item
                ? 'bg-ember/30 font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,69,21,0.45)]'
                : 'liquid-glass text-white/75 hover:text-white',
            ].join(' ')}
          >
            {item === 'ALL' ? 'All' : item.replaceAll('_', ' ')}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          {(['risk', 'date'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setSort(item)}
              className={[
                'rounded-full px-4 py-2 text-sm capitalize transition',
                sort === item
                  ? 'bg-white text-ink font-semibold'
                  : 'liquid-glass text-white/75 hover:text-white',
              ].join(' ')}
            >
              Sort · {item}
            </button>
          ))}
        </div>
      </div>

      <Panel>
        {loading && <LoadingBlock label="Loading cases…" />}
        {!loading && error && (
          <div className="px-6 py-10 text-center text-sm text-red-300">{error}</div>
        )}
        {!loading && !error && cases.length === 0 && (
          <EmptyState
            title="Queue is clear"
            body="New cases from KYC, documents, or payments will appear here instantly."
          />
        )}
        {!loading && !error && cases.length > 0 && (
          <ul className="divide-y divide-white/10">
            {cases.map((item) => (
              <li key={item.id}>
                <Link
                  to={`/desk/cases/${item.id}`}
                  className="flex flex-col gap-4 px-5 py-5 transition hover:bg-white/[0.03] sm:flex-row sm:items-center sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-xl font-bold text-white">
                        {item.customerName}
                      </p>
                      <StatusPill tone={caseTone(item.status)}>
                        {item.status.replaceAll('_', ' ')}
                      </StatusPill>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-mute">{item.explanation}</p>
                    <p className="mt-2 text-xs text-white/40">{formatWhen(item.createdAt)}</p>
                  </div>
                  <RiskBar score={item.riskScoreAtCreation} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
