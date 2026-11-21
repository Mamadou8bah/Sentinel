import type { FormEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, api } from '../../api/client'
import type { CaseDecision, CaseResponse, CustomerDetail, DocumentResponse } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { Icon } from '../../components/desk/icons'
import {
  DataRow,
  ErrorState,
  Field,
  Notice,
  PageHeader,
  Panel,
  PanelHeader,
  ScoreScale,
  SkeletonRows,
  Stamp,
  Status,
  ToneMarker,
  buttonClass,
  formatPct,
  formatWhen,
  inputClass,
  riskLabel,
  riskTone,
} from '../../components/desk/ui'

const decisions: Array<{ value: CaseDecision; label: string; help: string }> = [
  { value: 'APPROVE', label: 'Approve', help: 'Clear the case and allow the customer or payment.' },
  { value: 'ESCALATE', label: 'Escalate', help: 'Keep the case under review for a senior officer.' },
  { value: 'REJECT', label: 'Reject', help: 'Close the case as rejected. This is recorded in the audit log.' },
]

type Load<T> = { state: 'idle' | 'loading' | 'ready' | 'missing' | 'error'; data: T | null }

export default function CaseDetailPage() {
  const { id } = useParams()
  const { hasRole } = useAuth()
  const canDecide = hasRole('ADMIN', 'COMPLIANCE')

  const [item, setItem] = useState<CaseResponse | null>(null)
  const [doc, setDoc] = useState<Load<DocumentResponse>>({ state: 'idle', data: null })
  const [customer, setCustomer] = useState<Load<CustomerDetail>>({ state: 'idle', data: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const [decision, setDecision] = useState<CaseDecision | null>(null)
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmReject, setConfirmReject] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const caseItem = await api.get<CaseResponse>(`/api/cases/${id}`)
      setItem(caseItem)
      setLoading(false)

      // Evidence from existing endpoints; each part fails independently.
      if (caseItem.relatedDocumentId) {
        setDoc({ state: 'loading', data: null })
        api
          .get<DocumentResponse>(`/api/documents/${caseItem.relatedDocumentId}`)
          .then((d) => setDoc({ state: 'ready', data: d }))
          .catch(() => setDoc({ state: 'error', data: null }))
      } else {
        setDoc({ state: 'missing', data: null })
      }
      setCustomer({ state: 'loading', data: null })
      api
        .get<CustomerDetail>(`/api/customers/${caseItem.customerId}`)
        .then((c) => setCustomer({ state: 'ready', data: c }))
        .catch(() => setCustomer({ state: 'error', data: null }))
    } catch (err) {
      setError(err)
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (confirmReject) confirmRef.current?.focus()
  }, [confirmReject])

  async function record() {
    if (!id || !decision) return
    setBusy(true)
    setResult(null)
    try {
      const updated = await api.patch<CaseResponse>(`/api/cases/${id}/decision`, { decision, note: note.trim() })
      setItem(updated)
      setResult({ tone: 'success', text: `Decision recorded: ${riskLabel(decision)}. It is in the audit log.` })
      setNote('')
      setDecision(null)
      setConfirmReject(false)
    } catch (err) {
      setResult({ tone: 'error', text: err instanceof ApiError ? err.message : 'The decision was not saved. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!decision) {
      setFormError('Choose a decision.')
      return
    }
    if (note.trim().length === 0) {
      setFormError('Add a note explaining the decision. It is kept in the audit log.')
      noteRef.current?.focus()
      return
    }
    setFormError(null)
    if (decision === 'REJECT' && !confirmReject) {
      setConfirmReject(true)
      return
    }
    void record()
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader meta={`Case #${id}`} title="Loading case…" />
        <Panel>
          <SkeletonRows rows={6} label="Loading case" />
        </Panel>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="space-y-5">
        <PageHeader meta={<Link to="/desk/cases" className="hover:underline">Cases</Link>} title={`Case #${id}`} />
        <Panel>
          <ErrorState error={error ?? new ApiError(404, 'Case not found')} onRetry={() => void load()} what="this case" />
        </Panel>
      </div>
    )
  }

  const d = doc.data
  const c = customer.data
  const notAvailable = <span className="text-content-subtle">Not available</span>

  return (
    <div className="space-y-5">
      <PageHeader
        meta={
          <span className="inline-flex items-center gap-1.5">
            <Link to="/desk/cases" className="inline-flex items-center gap-1 hover:underline">
              <Icon name="arrow-left" size={14} />
              Cases
            </Link>
            <span aria-hidden>/</span>
            <span className="font-mono">#{item.id}</span>
          </span>
        }
        title={item.customerName}
        actions={
          <>
            <Status value={item.status} />
            {item.decision && <Stamp value={item.decision} />}
            <Link to={`/desk/customers/${item.customerId}`} className={buttonClass('secondary', 'sm')}>
              Customer record
            </Link>
          </>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Evidence */}
        <div className="space-y-4">
          <Panel labelledBy="verdict">
            <PanelHeader id="verdict" title="Risk at case creation" description="0–39 allow · 40–69 review · 70–100 block" />
            <div className="grid gap-5 p-4 md:grid-cols-[16rem_minmax(0,1fr)]">
              <ScoreScale score={item.riskScoreAtCreation} />
              <div>
                <h3 className="text-xs font-medium text-content-muted">Why this case was opened</h3>
                <p className="mt-1 text-sm leading-6 text-content">{item.explanation || 'Not available'}</p>
              </div>
            </div>
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel labelledBy="identity-evidence">
              <PanelHeader id="identity-evidence" title="Identity evidence" description="From the customer's KYC check" />
              <div className="px-4 py-2">
                {customer.state === 'loading' ? (
                  <SkeletonRows rows={3} label="Loading identity evidence" />
                ) : customer.state === 'error' ? (
                  <p className="py-3 text-sm text-content-muted">Identity evidence couldn’t be loaded.</p>
                ) : (
                  <dl>
                    <DataRow label="KYC status">{c ? <Status value={c.kycStatus} /> : notAvailable}</DataRow>
                    <DataRow label="Face match">{c?.faceMatchScore != null ? formatPct(c.faceMatchScore) : notAvailable}</DataRow>
                    <DataRow label="Liveness">{c?.livenessScore != null ? formatPct(c.livenessScore) : notAvailable}</DataRow>
                    <DataRow label="ID number">
                      {c?.idNumberMasked ? <span className="font-mono">{c.idNumberMasked}</span> : notAvailable}
                    </DataRow>
                    <DataRow label="Signature specimen">{c ? (c.hasSignatureSpecimen ? 'On file' : 'Not on file') : notAvailable}</DataRow>
                  </dl>
                )}
              </div>
            </Panel>

            <Panel labelledBy="document-evidence">
              <PanelHeader
                id="document-evidence"
                title="Document evidence"
                description={d ? `${riskLabel(d.type)} #${d.id}` : 'Related document'}
              />
              <div className="px-4 py-2">
                {doc.state === 'loading' ? (
                  <SkeletonRows rows={3} label="Loading document evidence" />
                ) : doc.state === 'missing' ? (
                  <p className="py-3 text-sm text-content-muted">No document is linked to this case.</p>
                ) : doc.state === 'error' || !d ? (
                  <p className="py-3 text-sm text-content-muted">Document evidence couldn’t be loaded.</p>
                ) : (
                  <dl>
                    <DataRow label="Tampering">{formatPct(d.tamperingScore)}</DataRow>
                    <DataRow label="Fraud risk">{formatPct(d.fraudRiskScore)}</DataRow>
                    <DataRow label="Signature match">
                      {d.signatureMatchStatus === 'SCORED' ? formatPct(d.signatureMatchScore) : riskLabel(d.signatureMatchStatus)}
                    </DataRow>
                    <DataRow label="Field checks">
                      {d.fieldConsistencyFlags && d.fieldConsistencyFlags.length > 0 ? (
                        <span className="inline-flex flex-col items-end gap-1">
                          {d.fieldConsistencyFlags.map((f) => (
                            <span key={f} className="inline-flex items-center gap-1.5 text-risk-review">
                              <ToneMarker tone="review" />
                              {riskLabel(f)}
                            </span>
                          ))}
                        </span>
                      ) : (
                        'No inconsistencies'
                      )}
                    </DataRow>
                  </dl>
                )}
              </div>
            </Panel>
          </div>

          <Panel labelledBy="timeline">
            <PanelHeader id="timeline" title="Timeline" />
            <dl className="px-4 py-2">
              <DataRow label="Opened">{formatWhen(item.createdAt)}</DataRow>
              <DataRow label="Last updated">{formatWhen(item.updatedAt)}</DataRow>
              {item.decision && (
                <DataRow label="Decision">
                  <Stamp value={item.decision} />
                </DataRow>
              )}
            </dl>
            {item.decisionNote && (
              <div className="border-t border-line px-4 py-3">
                <h3 className="text-xs font-medium text-content-muted">Decision note</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-content">{item.decisionNote}</p>
              </div>
            )}
          </Panel>
        </div>

        {/* Decision */}
        <aside className="lg:sticky lg:top-6" aria-labelledby="decide">
          <Panel as="div">
            <PanelHeader id="decide" title="Decision" />
            <div className="p-4">
              {result && (
                <Notice tone={result.tone} className="mb-4">
                  {result.text}
                </Notice>
              )}

              {!canDecide ? (
                <p className="text-sm text-content-muted">
                  Recording a decision needs the Compliance or Admin role. You can still review the evidence.
                </p>
              ) : item.status === 'RESOLVED' ? (
                <div className="space-y-2 text-sm text-content-muted">
                  <p className="flex flex-wrap items-center gap-2">
                    Resolved as {item.decision ? <Stamp value={item.decision} /> : 'Not available'}
                  </p>
                  <p>Resolved cases can’t be changed here.</p>
                </div>
              ) : (
                <form onSubmit={onSubmit} noValidate className="space-y-4">
                  <fieldset>
                    <legend className="mb-2 text-xs font-medium text-content-muted">Outcome</legend>
                    <div className="space-y-1.5">
                      {decisions.map((opt) => {
                        const tone = riskTone(opt.value)
                        const checked = decision === opt.value
                        return (
                          <label
                            key={opt.value}
                            className={[
                              'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                              checked ? 'border-content-muted bg-surface-raised' : 'border-line hover:border-line-strong',
                            ].join(' ')}
                          >
                            <input
                              type="radio"
                              name="decision"
                              value={opt.value}
                              checked={checked}
                              onChange={() => {
                                setDecision(opt.value)
                                setConfirmReject(false)
                                setFormError(null)
                              }}
                              className="mt-1 h-4 w-4 accent-accent-ink"
                            />
                            <span>
                              <span className="flex items-center gap-1.5 text-sm font-medium text-content">
                                <ToneMarker tone={tone} />
                                {opt.label}
                              </span>
                              <span className="mt-0.5 block text-xs text-content-muted">{opt.help}</span>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </fieldset>

                  <Field
                    label="Note for the audit log"
                    htmlFor="decision-note"
                    error={formError && formError.startsWith('Add') ? formError : null}
                  >
                    <textarea
                      id="decision-note"
                      ref={noteRef}
                      className={`${inputClass} min-h-[110px] resize-y`}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      aria-invalid={Boolean(formError && formError.startsWith('Add')) || undefined}
                      placeholder="What did you check, and why this outcome?"
                    />
                  </Field>

                  {formError && formError.startsWith('Choose') && (
                    <p role="alert" className="flex items-center gap-1.5 text-xs text-risk-block">
                      <ToneMarker tone="block" />
                      {formError}
                    </p>
                  )}

                  {confirmReject ? (
                    <div role="alertdialog" aria-labelledby="confirm-reject" className="space-y-3 rounded-lg border border-risk-block p-3">
                      <p id="confirm-reject" className="text-sm text-content">
                        Reject this case? It will be closed as rejected for {item.customerName}.
                      </p>
                      <div className="flex gap-2">
                        <button
                          ref={confirmRef}
                          type="button"
                          disabled={busy}
                          onClick={() => void record()}
                          className={buttonClass('danger')}
                        >
                          {busy ? 'Saving…' : 'Confirm reject'}
                        </button>
                        <button type="button" onClick={() => setConfirmReject(false)} className={buttonClass('ghost')}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="submit" disabled={busy} className={`${buttonClass('primary')} w-full`}>
                      {busy ? 'Saving…' : 'Record decision'}
                    </button>
                  )}
                </form>
              )}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  )
}
