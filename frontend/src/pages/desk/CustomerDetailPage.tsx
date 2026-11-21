import type { FormEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, api } from '../../api/client'
import type { CustomerDetail, DocumentResponse, TxHistoryItem } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { DataTable, type Column } from '../../components/desk/DataTable'
import { Icon } from '../../components/desk/icons'
import {
  DataRow,
  EmptyState,
  ErrorState,
  Field,
  Notice,
  PageHeader,
  Pagination,
  Panel,
  PanelHeader,
  Score,
  SkeletonRows,
  Status,
  buttonClass,
  fileInputClass,
  formatMoney,
  formatPct,
  formatWhen,
  riskLabel,
} from '../../components/desk/ui'
import { usePagination } from '../../hooks/usePagination'
import { fileToBase64 } from '../../lib/files'

export default function CustomerDetailPage() {
  const { id } = useParams()
  const { hasRole } = useAuth()
  const canEnroll = hasRole('ADMIN', 'COMPLIANCE', 'ANALYST')

  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [txs, setTxs] = useState<TxHistoryItem[]>([])
  const [docs, setDocs] = useState<DocumentResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [specimenFile, setSpecimenFile] = useState<File | null>(null)
  const [specimenMsg, setSpecimenMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [specimenBusy, setSpecimenBusy] = useState(false)
  const docPager = usePagination(docs, 10)
  const txPager = usePagination(txs, 15)

  const reload = useCallback(async () => {
    if (!id) return
    const [detail, history, documents] = await Promise.all([
      api.get<CustomerDetail>(`/api/customers/${id}`),
      api.get<TxHistoryItem[]>(`/api/customers/${id}/transactions`),
      api.get<DocumentResponse[]>(`/api/customers/${id}/documents`),
    ])
    setCustomer(detail)
    setTxs(history)
    setDocs(documents)
  }, [id])

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    reload()
      .catch((err) => setError(err))
      .finally(() => setLoading(false))
  }, [reload])

  useEffect(() => {
    load()
  }, [load])

  async function enrollSpecimen(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    if (!specimenFile) {
      setSpecimenMsg({ tone: 'error', text: 'Choose an image of the customer’s signature first.' })
      return
    }
    setSpecimenBusy(true)
    setSpecimenMsg(null)
    try {
      const signatureImage = await fileToBase64(specimenFile)
      await api.post(`/api/customers/${id}/signature-specimen`, { signatureImage })
      setSpecimenMsg({ tone: 'success', text: 'Signature specimen saved.' })
      setSpecimenFile(null)
      await reload()
    } catch (err) {
      setSpecimenMsg({ tone: 'error', text: err instanceof ApiError ? err.message : 'The specimen was not saved. Try again.' })
    } finally {
      setSpecimenBusy(false)
    }
  }

  const crumbs = (
    <Link to="/desk/customers" className="inline-flex items-center gap-1 hover:underline">
      <Icon name="arrow-left" size={14} />
      Customers
    </Link>
  )

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader meta={crumbs} title="Loading customer…" />
        <Panel>
          <SkeletonRows rows={6} label="Loading customer" />
        </Panel>
      </div>
    )
  }
  if (error || !customer) {
    return (
      <div className="space-y-5">
        <PageHeader meta={crumbs} title="Customer" />
        <Panel>
          <ErrorState error={error ?? new ApiError(404, 'Customer not found')} onRetry={load} what="this customer" />
        </Panel>
      </div>
    )
  }

  const docColumns: Column<DocumentResponse>[] = [
    {
      key: 'doc',
      header: 'Document',
      rowHeader: true,
      render: (d) => (
        <span className="whitespace-nowrap">
          {riskLabel(d.type)} <span className="font-mono text-xs text-content-subtle">#{d.id}</span>
        </span>
      ),
    },
    { key: 'status', header: 'Status', render: (d) => <Status value={d.status} /> },
    { key: 'tamper', header: 'Tampering', align: 'right', render: (d) => <span className="font-mono">{formatPct(d.tamperingScore)}</span> },
    { key: 'fraud', header: 'Fraud risk', align: 'right', render: (d) => <span className="font-mono">{formatPct(d.fraudRiskScore)}</span> },
    {
      key: 'sig',
      header: 'Signature',
      align: 'right',
      hideOnMobile: true,
      render: (d) =>
        d.signatureMatchStatus === 'SCORED' ? (
          <span className="font-mono">{formatPct(d.signatureMatchScore)}</span>
        ) : (
          <span className="text-content-subtle">{riskLabel(d.signatureMatchStatus)}</span>
        ),
    },
    {
      key: 'when',
      header: 'Checked',
      hideOnMobile: true,
      render: (d) => <span className="whitespace-nowrap text-xs text-content-subtle">{formatWhen(d.createdAt)}</span>,
    },
  ]

  const txColumns: Column<TxHistoryItem>[] = [
    {
      key: 'when',
      header: 'Date',
      rowHeader: true,
      sortValue: (t) => t.occurredAt,
      render: (t) => <span className="whitespace-nowrap text-xs tabular-nums text-content-muted">{formatWhen(t.occurredAt)}</span>,
    },
    {
      key: 'channel',
      header: 'Channel',
      hideOnMobile: true,
      render: (t) => <span className="text-content-muted">{t.channel ? riskLabel(t.channel) : 'Not available'}</span>,
    },
    {
      key: 'ref',
      header: 'Reference',
      hideOnMobile: true,
      render: (t) => <span className="font-mono text-xs text-content-subtle">{t.externalTransactionId}</span>,
    },
    {
      key: 'rec',
      header: 'Recommendation',
      render: (t) => (t.recommendation ? <Status value={t.recommendation} /> : <span className="text-content-subtle">Not available</span>),
    },
    {
      key: 'anomaly',
      header: 'Anomaly',
      align: 'right',
      sortValue: (t) => t.anomalyScore,
      render: (t) => <span className="font-mono">{formatPct(t.anomalyScore)}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      sortValue: (t) => t.amount,
      render: (t) => <span className="whitespace-nowrap font-mono">{formatMoney(t.amount, t.currency)}</span>,
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        meta={crumbs}
        title={customer.name}
        subtitle={
          <>
            Bank ID <span className="font-mono">{customer.externalCustomerId || 'not available'}</span>
          </>
        }
        actions={
          <>
            <Status value={customer.kycStatus} />
            <Score score={customer.riskScore} />
          </>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel labelledBy="identity">
            <PanelHeader id="identity" title="Identity" />
            <dl className="px-4 py-2">
              <DataRow label="KYC status"><Status value={customer.kycStatus} /></DataRow>
              <DataRow label="Face match">{formatPct(customer.faceMatchScore)}</DataRow>
              <DataRow label="Liveness">{formatPct(customer.livenessScore)}</DataRow>
              <DataRow label="Date of birth">{customer.dob || 'Not available'}</DataRow>
              <DataRow label="ID number">
                {customer.idNumberMasked ? <span className="font-mono">{customer.idNumberMasked}</span> : 'Not available'}
              </DataRow>
              <DataRow label="Documents">{customer.documentCount}</DataRow>
              <DataRow label="Payments">{customer.transactionCount}</DataRow>
              <DataRow label="Customer since">{formatWhen(customer.createdAt)}</DataRow>
            </dl>
          </Panel>

          <Panel labelledBy="specimen">
            <PanelHeader
              id="specimen"
              title="Signature specimen"
              description={customer.hasSignatureSpecimen ? 'On file' : 'Not on file'}
            />
            <div className="p-4">
              <p className="text-sm text-content-muted">Cheque signatures are only matched when a specimen is on file.</p>
              {canEnroll && (
                <form onSubmit={enrollSpecimen} className="mt-3 space-y-3">
                  <Field label={customer.hasSignatureSpecimen ? 'Replace specimen image' : 'Specimen image'}>
                    <input
                      type="file"
                      accept="image/*"
                      className={fileInputClass}
                      onChange={(e) => setSpecimenFile(e.target.files?.[0] ?? null)}
                    />
                  </Field>
                  {specimenMsg && <Notice tone={specimenMsg.tone}>{specimenMsg.text}</Notice>}
                  <button type="submit" disabled={specimenBusy} className={buttonClass('secondary')}>
                    {specimenBusy ? 'Uploading…' : 'Save specimen'}
                  </button>
                </form>
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel labelledBy="payments">
            <PanelHeader id="payments" title="Payments" description="Transactions scored for this customer" />
            <DataTable
              caption="Payments"
              rows={txPager.slice}
              columns={txColumns}
              rowKey={(t) => t.id}
              empty={<EmptyState title="No scored payments yet" />}
            />
            <Pagination
              label="Payment pages"
              page={txPager.page}
              totalPages={txPager.totalPages}
              total={txPager.total}
              from={txPager.from}
              to={txPager.to}
              onChange={txPager.setPage}
            />
          </Panel>

          <Panel labelledBy="documents">
            <PanelHeader id="documents" title="Documents" />
            <DataTable
              caption="Documents"
              rows={docPager.slice}
              columns={docColumns}
              rowKey={(d) => d.id}
              empty={<EmptyState title="No documents checked yet" />}
            />
            <Pagination
              label="Document pages"
              page={docPager.page}
              totalPages={docPager.totalPages}
              total={docPager.total}
              from={docPager.from}
              to={docPager.to}
              onChange={docPager.setPage}
            />
          </Panel>
        </div>
      </div>
    </div>
  )
}
