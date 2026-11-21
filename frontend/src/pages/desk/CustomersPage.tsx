import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import type { CustomerSummary, KycStatus } from '../../api/types'
import { DataTable, type Column } from '../../components/desk/DataTable'
import { Icon } from '../../components/desk/icons'
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Panel,
  Score,
  Segmented,
  Status,
  buttonClass,
  inputClass,
} from '../../components/desk/ui'
import { usePagination } from '../../hooks/usePagination'

const PAGE_SIZE = 25
type KycFilter = KycStatus | 'ALL'
const kycOptions: Array<{ value: KycFilter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'FLAGGED', label: 'Flagged' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'REJECTED', label: 'Rejected' },
]

function isKyc(v: string | null): v is KycFilter {
  return v === 'ALL' || v === 'FLAGGED' || v === 'PENDING' || v === 'VERIFIED' || v === 'REJECTED'
}

export default function CustomersPage() {
  const [params, setParams] = useSearchParams()
  const kycParam = params.get('kyc')
  const kyc: KycFilter = isKyc(kycParam) ? kycParam : 'ALL'
  const highRiskOnly = params.get('risk') === 'high'
  const query = params.get('q') ?? ''

  const [rows, setRows] = useState<CustomerSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    api
      .get<CustomerSummary[]>('/api/customers')
      .then(setRows)
      .catch((err) => setError(err))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function setParam(key: string, value: string | null) {
    const p = new URLSearchParams(params)
    if (value == null || value === '' || value === 'ALL') p.delete(key)
    else p.set(key, value)
    setParams(p, { replace: true })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (kyc === 'ALL' || r.kycStatus === kyc) &&
        (!highRiskOnly || r.riskScore >= 70) &&
        (!q || r.name.toLowerCase().includes(q) || (r.externalCustomerId ?? '').toLowerCase().includes(q)),
    )
  }, [rows, kyc, highRiskOnly, query])
  const pager = usePagination(filtered, PAGE_SIZE)
  const hasFilters = kyc !== 'ALL' || highRiskOnly || query.trim() !== ''

  const columns: Column<CustomerSummary>[] = [
    {
      key: 'name',
      header: 'Customer',
      rowHeader: true,
      sortValue: (r) => r.name.toLowerCase(),
      render: (r) => (
        <Link to={`/desk/customers/${r.id}`} className="font-medium text-content hover:underline">
          {r.name}
        </Link>
      ),
    },
    {
      key: 'external',
      header: 'Bank customer ID',
      hideOnMobile: true,
      render: (r) =>
        r.externalCustomerId ? (
          <span className="font-mono text-xs text-content-muted">{r.externalCustomerId}</span>
        ) : (
          <span className="text-content-subtle">Not available</span>
        ),
    },
    { key: 'kyc', header: 'KYC', sortValue: (r) => r.kycStatus, render: (r) => <Status value={r.kycStatus} /> },
    {
      key: 'specimen',
      header: 'Signature specimen',
      hideOnMobile: true,
      render: (r) => <span className="text-content-muted">{r.hasSignatureSpecimen ? 'On file' : 'Not on file'}</span>,
    },
    { key: 'risk', header: 'Risk', align: 'right', sortValue: (r) => r.riskScore, render: (r) => <Score score={r.riskScore} /> },
  ]

  return (
    <div className="space-y-5">
      <PageHeader title="Customers" subtitle="Identity status and rolling risk for customers verified through your bank." />

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative block w-full sm:w-72">
          <span className="sr-only">Search customers</span>
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-subtle" />
          <input
            type="search"
            value={query}
            onChange={(e) => setParam('q', e.target.value)}
            placeholder="Search name or bank ID"
            className={`${inputClass} pl-9`}
          />
        </label>
        <Segmented label="KYC status" value={kyc} options={kycOptions} onChange={(v) => setParam('kyc', v)} />
        {highRiskOnly && (
          <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => setParam('risk', null)}>
            Risk 70+ only
            <Icon name="close" size={14} label="Remove filter" />
          </button>
        )}
      </div>

      <Panel>
        {error ? (
          <ErrorState error={error} onRetry={load} what="customers" />
        ) : (
          <>
            <DataTable
              caption="Customers"
              rows={pager.slice}
              columns={columns}
              rowKey={(r) => r.id}
              loading={loading}
              empty={
                hasFilters && rows.length > 0 ? (
                  <EmptyState
                    title="No customers match these filters"
                    action={
                      <button type="button" className={buttonClass('secondary')} onClick={() => setParams({}, { replace: true })}>
                        Clear filters
                      </button>
                    }
                  />
                ) : (
                  <EmptyState title="No customers yet" body="Customers appear after the bank completes a KYC session with Sentinel." />
                )
              }
            />
            {!loading && (
              <Pagination
                label="Customer pages"
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
