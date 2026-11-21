import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, api } from '../../api/client'
import type { DocumentResponse, DocumentType, TxImportResponse, TxScoreResponse } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import {
  DataRow,
  Field,
  Notice,
  PageHeader,
  Panel,
  PanelHeader,
  Stamp,
  buttonClass,
  fileInputClass,
  formatPct,
  inputClass,
  riskLabel,
} from '../../components/desk/ui'
import { fileToBase64 } from '../../lib/files'

export default function ToolsPage() {
  const { hasRole } = useAuth()
  const canScore = hasRole('ADMIN', 'ANALYST')
  const canDocs = hasRole('ADMIN', 'COMPLIANCE', 'ANALYST')

  return (
    <div className="space-y-5">
      <PageHeader title="Tools" subtitle="Score a payment, check a cheque or invoice, or import past transactions." />

      {!canScore && (
        <Notice tone="info">Scoring payments and importing transactions need the Analyst or Admin role.</Notice>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-2">
        {canScore && <ScoreTxPanel />}
        {canDocs && <VerifyDocumentPanel />}
        {canScore && <ImportCsvPanel />}
      </div>
    </div>
  )
}

type Shap = { feature: string; contribution: number; value?: number }

function readShap(list: TxScoreResponse['shapTopFeatures'] | undefined): Shap[] {
  if (!Array.isArray(list)) return []
  return list
    .map((r) => ({
      feature: typeof r.feature === 'string' ? r.feature : '',
      contribution: typeof r.contribution === 'number' ? r.contribution : NaN,
      value: typeof r.value === 'number' ? r.value : undefined,
    }))
    .filter((r) => r.feature && Number.isFinite(r.contribution))
    .slice(0, 6)
}

/** Ranked contribution bars; positive pushes towards a flag, negative away from it. */
function Contributions({ items }: { items: Shap[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-content-subtle">Model contributions: not available for this score.</p>
  }
  const max = Math.max(...items.map((i) => Math.abs(i.contribution))) || 1
  return (
    <table className="w-full text-sm">
      <caption className="mb-2 text-left text-xs font-medium text-content-muted">Top model contributions</caption>
      <tbody>
        {items.map((i) => {
          const width = `${(Math.abs(i.contribution) / max) * 100}%`
          const up = i.contribution >= 0
          return (
            <tr key={i.feature} className="border-b border-line last:border-b-0">
              <th scope="row" className="py-1.5 pr-3 text-left font-mono text-xs font-normal text-content">
                {i.feature}
              </th>
              <td className="w-1/3 py-1.5" aria-hidden>
                <span className="block h-1.5 rounded-sm bg-surface-raised">
                  <span className={`block h-full rounded-sm ${up ? 'bg-risk-review' : 'bg-content-subtle'}`} style={{ width }} />
                </span>
              </td>
              <td className="py-1.5 pl-3 text-right font-mono text-xs tabular-nums text-content-muted">
                {up ? '+' : '−'}
                {Math.abs(i.contribution).toFixed(2)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function ScoreTxPanel() {
  const [externalCustomerId, setExternalCustomerId] = useState('')
  const [externalTransactionId, setExternalTransactionId] = useState(() => `desk-${Date.now()}`)
  const [amount, setAmount] = useState('1200.50')
  const [currency, setCurrency] = useState('GMD')
  const [channel, setChannel] = useState('MOBILE')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TxScoreResponse | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const scored = await api.post<TxScoreResponse>('/api/transactions/score', {
        externalCustomerId: externalCustomerId.trim(),
        externalTransactionId: externalTransactionId.trim(),
        amount: Number(amount),
        currency,
        timestamp: new Date().toISOString(),
        channel,
      })
      setResult(scored)
      setExternalTransactionId(`desk-${Date.now()}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The payment was not scored. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel labelledBy="score-payment">
      <PanelHeader id="score-payment" title="Score a payment" description="Real-time risk score for an existing bank customer" />
      <form onSubmit={onSubmit} className="space-y-4 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bank customer ID">
            <input
              className={`${inputClass} font-mono`}
              value={externalCustomerId}
              onChange={(e) => setExternalCustomerId(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              required
            />
          </Field>
          <Field label="Transaction reference">
            <input
              className={`${inputClass} font-mono`}
              value={externalTransactionId}
              onChange={(e) => setExternalTransactionId(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              required
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Amount">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              className={`${inputClass} text-right font-mono tabular-nums`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </Field>
          <Field label="Currency">
            <input className={`${inputClass} font-mono`} value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </Field>
          <Field label="Channel">
            <input className={`${inputClass} font-mono`} value={channel} onChange={(e) => setChannel(e.target.value)} />
          </Field>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <button type="submit" disabled={busy} className={buttonClass('primary')}>
          {busy ? 'Scoring…' : 'Score payment'}
        </button>
      </form>
      {result && (
        <div role="status" className="space-y-3 border-t border-line p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Stamp value={result.recommendation || (result.flagged ? 'REVIEW' : 'ALLOW')} />
            <span className="text-sm text-content-muted">
              Anomaly <span className="font-mono tabular-nums text-content">{formatPct(result.anomalyScore)}</span>
            </span>
            {result.caseId && (
              <Link to={`/desk/cases/${result.caseId}`} className="text-sm font-medium text-accent-ink hover:underline">
                Case #{result.caseId} opened
              </Link>
            )}
          </div>
          {result.explanation && <p className="text-sm text-content">{result.explanation}</p>}
          {result.ruleFlags?.length > 0 && (
            <p className="text-xs text-content-muted">
              Rules triggered: {result.ruleFlags.map((f) => riskLabel(f)).join(', ')}
            </p>
          )}
          <Contributions items={readShap(result.shapTopFeatures)} />
        </div>
      )}
    </Panel>
  )
}

function VerifyDocumentPanel() {
  const [externalCustomerId, setExternalCustomerId] = useState('')
  const [docType, setDocType] = useState<DocumentType>('CHEQUE')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DocumentResponse | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!file) {
      setError('Choose an image or PDF of the document.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const documentImage = await fileToBase64(file)
      const doc = await api.post<DocumentResponse>('/api/documents', {
        externalCustomerId: externalCustomerId.trim(),
        docType,
        documentImage,
      })
      setResult(doc)
      setFile(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The document was not checked. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel labelledBy="verify-document">
      <PanelHeader id="verify-document" title="Check a document" description="Tampering, fraud and signature checks on a cheque or invoice" />
      <form onSubmit={onSubmit} className="space-y-4 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bank customer ID">
            <input
              className={`${inputClass} font-mono`}
              value={externalCustomerId}
              onChange={(e) => setExternalCustomerId(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              required
            />
          </Field>
          <Field label="Document type">
            <select className={inputClass} value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)}>
              <option value="CHEQUE">Cheque</option>
              <option value="INVOICE">Invoice</option>
              <option value="ID">ID document</option>
            </select>
          </Field>
        </div>
        <Field label="Image or PDF">
          <input type="file" accept="image/*,.pdf" className={fileInputClass} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <button type="submit" disabled={busy} className={buttonClass('primary')}>
          {busy ? 'Checking…' : 'Check document'}
        </button>
      </form>
      {result && (
        <div role="status" className="border-t border-line p-4">
          <p className="text-sm font-medium text-content">
            {riskLabel(result.type)} <span className="font-mono text-xs text-content-subtle">#{result.id}</span>
          </p>
          <dl className="mt-2">
            <DataRow label="Tampering">{formatPct(result.tamperingScore)}</DataRow>
            <DataRow label="Fraud risk">{formatPct(result.fraudRiskScore)}</DataRow>
            <DataRow label="Signature match">
              {result.signatureMatchStatus === 'SCORED' ? formatPct(result.signatureMatchScore) : riskLabel(result.signatureMatchStatus)}
            </DataRow>
          </dl>
        </div>
      )}
    </Panel>
  )
}

function ImportCsvPanel() {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TxImportResponse | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!file) {
      setError('Choose a CSV file.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const imported = await api.postForm<TxImportResponse>('/api/transactions/import', body)
      setResult(imported)
      setFile(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The import failed. Check the file and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel labelledBy="import-csv" className="xl:col-span-2">
      <PanelHeader id="import-csv" title="Import past transactions" description="CSV backfill. Live scoring through the API is the main path." />
      <form onSubmit={onSubmit} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field label="CSV file">
            <input type="file" accept=".csv,text/csv" className={fileInputClass} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Field>
        </div>
        <button type="submit" disabled={busy} className={buttonClass('secondary')}>
          {busy ? 'Importing…' : 'Import CSV'}
        </button>
      </form>
      <div className="space-y-2 px-4 pb-4 empty:hidden">
        {error && <Notice tone="error">{error}</Notice>}
        {result && (
          <Notice tone={result.failed > 0 ? 'error' : 'success'}>
            Imported <span className="font-mono tabular-nums">{result.processed}</span> rows;{' '}
            <span className="font-mono tabular-nums">{result.failed}</span> failed.
          </Notice>
        )}
      </div>
    </Panel>
  )
}
