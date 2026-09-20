import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, api } from '../../api/client'
import type { CaseDecision, CaseResponse, DocumentResponse } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import {
  Field,
  LoadingBlock,
  PageHeader,
  Panel,
  RiskBar,
  StatusPill,
  caseTone,
  formatWhen,
  inputClass,
} from '../../components/desk/ui'
import { pct } from '../../lib/files'

const decisions: CaseDecision[] = ['APPROVE', 'REJECT', 'ESCALATE']

export default function CaseDetailPage() {
  const { id } = useParams()
  const { hasRole } = useAuth()
  const canDecide = hasRole('ADMIN', 'COMPLIANCE')

  const [item, setItem] = useState<CaseResponse | null>(null)
  const [document, setDocument] = useState<DocumentResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [decision, setDecision] = useState<CaseDecision>('APPROVE')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api
      .get<CaseResponse>(`/api/cases/${id}`)
      .then(async (caseItem) => {
        setItem(caseItem)
        if (caseItem.relatedDocumentId) {
          try {
            const doc = await api.get<DocumentResponse>(
              `/api/documents/${caseItem.relatedDocumentId}`,
            )
            setDocument(doc)
          } catch {
            setDocument(null)
          }
        } else {
          setDocument(null)
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load case'))
      .finally(() => setLoading(false))
  }, [id])

  async function onDecide(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    setBusy(true)
    setMessage(null)
    try {
      const updated = await api.patch<CaseResponse>(`/api/cases/${id}/decision`, {
        decision,
        note,
      })
      setItem(updated)
      setMessage('Decision recorded')
      setNote('')
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Decision failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingBlock label="Opening case…" />
  if (error || !item) {
    return <div className="text-sm text-red-300">{error || 'Case not found'}</div>
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Case #${item.id}`}
        title={item.customerName}
        subtitle={item.explanation}
        actions={
          <>
            <StatusPill tone={caseTone(item.status)}>
              {item.status.replace(/_/g, ' ')}
            </StatusPill>
            <Link
              to={`/desk/customers/${item.customerId}`}
              className="liquid-glass rounded-full px-4 py-2 text-sm text-white/85 hover:text-white"
            >
              Customer 360°
            </Link>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <Panel className="p-6 md:p-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-white/45">Opened</p>
                <p className="mt-1 text-sm text-white/80">{formatWhen(item.createdAt)}</p>
                <p className="mt-5 text-xs uppercase tracking-[0.14em] text-white/45">Updated</p>
                <p className="mt-1 text-sm text-white/80">{formatWhen(item.updatedAt)}</p>
              </div>
              <RiskBar score={item.riskScoreAtCreation} />
            </div>

            <div className="mt-8 border-t border-white/10 pt-6">
              <p className="text-xs uppercase tracking-[0.14em] text-white/45">Explanation</p>
              <p className="mt-3 text-base leading-relaxed text-white/85">{item.explanation}</p>
            </div>

            {item.decision && (
              <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-5">
                <StatusPill tone="ok">{item.decision}</StatusPill>
                <p className="mt-3 text-sm text-white/80">{item.decisionNote}</p>
              </div>
            )}
          </Panel>

          {document && (
            <Panel className="p-6 md:p-8">
              <h2 className="font-display text-2xl font-bold">Related document</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusPill tone="ember">#{document.id}</StatusPill>
                <StatusPill tone="neutral">{document.type}</StatusPill>
                <StatusPill tone="neutral">{document.signatureMatchStatus}</StatusPill>
              </div>
              <p className="mt-4 text-sm text-white/80">
                Tampering {pct(document.tamperingScore)} · Fraud {pct(document.fraudRiskScore)}
                {document.signatureMatchScore != null
                  ? ` · Signature ${pct(document.signatureMatchScore)}`
                  : ''}
              </p>
              {document.fieldConsistencyFlags && document.fieldConsistencyFlags.length > 0 && (
                <p className="mt-2 text-xs text-mute">
                  {document.fieldConsistencyFlags.join(' · ')}
                </p>
              )}
            </Panel>
          )}
        </div>

        {canDecide && item.status !== 'RESOLVED' && (
          <Panel className="h-fit p-6 md:p-8">
            <h2 className="font-display text-2xl font-bold">Decide</h2>
            <p className="mt-1 text-sm text-mute">A note is required for the audit trail.</p>
            <form onSubmit={onDecide} className="mt-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                {decisions.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDecision(value)}
                    className={[
                      'rounded-full px-4 py-2 text-sm transition',
                      decision === value
                        ? 'bg-ember/30 font-semibold text-white'
                        : 'liquid-glass text-white/70',
                    ].join(' ')}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <Field label="Note">
                <textarea
                  className={`${inputClass} min-h-[120px] resize-y`}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  required
                  placeholder="Why this decision?"
                />
              </Field>
              {message && <p className="text-sm text-ember-glow">{message}</p>}
              <button
                type="submit"
                disabled={busy || note.trim().length === 0}
                className="w-full rounded-full bg-ember-grad py-3.5 text-sm font-semibold disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Record decision'}
              </button>
            </form>
          </Panel>
        )}
      </div>
    </div>
  )
}
