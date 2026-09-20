import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ApiError, api } from '../../api/client'
import type { CustomerDetail, DocumentResponse, TxHistoryItem } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import {
  Field,
  LoadingBlock,
  PageHeader,
  Panel,
  RiskBar,
  StatusPill,
  formatWhen,
  kycTone,
} from '../../components/desk/ui'
import { fileToBase64, pct } from '../../lib/files'

export default function CustomerDetailPage() {
  const { id } = useParams()
  const { hasRole } = useAuth()
  const canEnroll = hasRole('ADMIN', 'COMPLIANCE', 'ANALYST')

  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [txs, setTxs] = useState<TxHistoryItem[]>([])
  const [docs, setDocs] = useState<DocumentResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [specimenFile, setSpecimenFile] = useState<File | null>(null)
  const [specimenMsg, setSpecimenMsg] = useState<string | null>(null)
  const [specimenBusy, setSpecimenBusy] = useState(false)

  async function reload() {
    if (!id) return
    const [detail, history, documents] = await Promise.all([
      api.get<CustomerDetail>(`/api/customers/${id}`),
      api.get<TxHistoryItem[]>(`/api/customers/${id}/transactions`),
      api.get<DocumentResponse[]>(`/api/customers/${id}/documents`),
    ])
    setCustomer(detail)
    setTxs(history)
    setDocs(documents)
  }

  useEffect(() => {
    if (!id) return
    setLoading(true)
    reload()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load customer'))
      .finally(() => setLoading(false))
  }, [id])

  async function enrollSpecimen(e: FormEvent) {
    e.preventDefault()
    if (!id || !specimenFile) return
    setSpecimenBusy(true)
    setSpecimenMsg(null)
    try {
      const signatureImage = await fileToBase64(specimenFile)
      await api.post(`/api/customers/${id}/signature-specimen`, { signatureImage })
      setSpecimenMsg('Specimen enrolled')
      setSpecimenFile(null)
      await reload()
    } catch (err) {
      setSpecimenMsg(err instanceof ApiError ? err.message : 'Enroll failed')
    } finally {
      setSpecimenBusy(false)
    }
  }

  if (loading) return <LoadingBlock label="Loading 360°…" />
  if (error || !customer) {
    return <div className="text-sm text-red-300">{error || 'Customer not found'}</div>
  }

  const scores = [
    { label: 'Face match', value: customer.faceMatchScore },
    { label: 'Liveness', value: customer.livenessScore },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Customer 360°"
        title={customer.name}
        subtitle={`External ID ${customer.externalCustomerId || '—'} · ID ${customer.idNumberMasked || 'masked'}`}
        actions={
          <>
            <StatusPill tone={kycTone(customer.kycStatus)}>{customer.kycStatus}</StatusPill>
            <RiskBar score={customer.riskScore} />
          </>
        }
      />

      <div className="grid gap-5 md:grid-cols-3">
        {[
          { label: 'Documents', value: customer.documentCount },
          { label: 'Transactions', value: customer.transactionCount },
          {
            label: 'Specimen',
            value: customer.hasSignatureSpecimen ? 'Enrolled' : 'Missing',
          },
        ].map((stat) => (
          <Panel key={stat.label} className="p-6">
            <p className="text-xs uppercase tracking-[0.14em] text-white/45">{stat.label}</p>
            <p className="mt-3 font-display text-3xl font-bold">{stat.value}</p>
          </Panel>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="p-6 md:p-8">
          <h2 className="font-display text-2xl font-bold">Identity</h2>
          <dl className="mt-6 space-y-4 text-sm">
            <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
              <dt className="text-mute">Date of birth</dt>
              <dd>{customer.dob || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
              <dt className="text-mute">Created</dt>
              <dd>{formatWhen(customer.createdAt)}</dd>
            </div>
            {scores.map((score) => (
              <div
                key={score.label}
                className="flex justify-between gap-4 border-b border-white/10 pb-3"
              >
                <dt className="text-mute">{score.label}</dt>
                <dd>{pct(score.value)}</dd>
              </div>
            ))}
          </dl>

          {canEnroll && (
            <form onSubmit={enrollSpecimen} className="mt-8 border-t border-white/10 pt-6">
              <h3 className="font-display text-lg font-bold">Signature specimen</h3>
              <p className="mt-1 text-sm text-mute">
                Required before signature matching can score on documents.
              </p>
              <div className="mt-4 space-y-3">
                <Field label="Specimen image">
                  <input
                    type="file"
                    accept="image/*"
                    className="block w-full text-sm text-white/70 file:mr-4 file:rounded-full file:border-0 file:bg-ember/20 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ember-glow"
                    onChange={(e) => setSpecimenFile(e.target.files?.[0] ?? null)}
                  />
                </Field>
                {specimenMsg && <p className="text-sm text-ember-glow">{specimenMsg}</p>}
                <button
                  type="submit"
                  disabled={specimenBusy || !specimenFile}
                  className="rounded-full bg-ember-grad px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                >
                  {specimenBusy ? 'Uploading…' : 'Enroll specimen'}
                </button>
              </div>
            </form>
          )}
        </Panel>

        <Panel className="overflow-hidden">
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="font-display text-2xl font-bold">Documents</h2>
          </div>
          {docs.length === 0 ? (
            <p className="px-6 py-10 text-sm text-mute">No documents verified yet.</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {docs.map((doc) => (
                <li key={doc.id} className="px-6 py-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-white">
                      #{doc.id} · {doc.type}
                    </p>
                    <StatusPill tone="neutral">{doc.status}</StatusPill>
                    <StatusPill tone={doc.signatureMatchStatus === 'SCORED' ? 'ok' : 'warn'}>
                      {doc.signatureMatchStatus}
                    </StatusPill>
                  </div>
                  <p className="mt-2 text-mute">
                    Tampering {pct(doc.tamperingScore)} · Fraud {pct(doc.fraudRiskScore)}
                    {doc.signatureMatchScore != null
                      ? ` · Signature ${pct(doc.signatureMatchScore)}`
                      : ''}
                  </p>
                  <p className="mt-1 text-xs text-white/40">{formatWhen(doc.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <div className="border-b border-white/10 px-6 py-5">
          <h2 className="font-display text-2xl font-bold">Recent payments</h2>
        </div>
        {txs.length === 0 ? (
          <p className="px-6 py-10 text-sm text-mute">No scored transactions yet.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {txs.slice(0, 12).map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-4 px-6 py-4 text-sm">
                <div>
                  <p className="font-medium text-white">
                    {tx.amount} {tx.currency}
                  </p>
                  <p className="mt-1 text-xs text-mute">
                    {tx.channel || 'channel'} · {formatWhen(tx.occurredAt)}
                  </p>
                </div>
                <div className="text-right">
                  <StatusPill tone={tx.flagged ? 'danger' : 'ok'}>
                    {tx.recommendation || (tx.flagged ? 'FLAG' : 'OK')}
                  </StatusPill>
                  <p className="mt-2 text-xs text-mute">anomaly {pct(tx.anomalyScore)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
