import type { FormEvent } from 'react'
import { useState } from 'react'
import { ApiError, api } from '../../api/client'
import type { DocumentResponse, DocumentType, TxImportResponse, TxScoreResponse } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { Field, PageHeader, Panel, StatusPill, inputClass } from '../../components/desk/ui'
import { fileToBase64, pct } from '../../lib/files'

export default function ToolsPage() {
  const { hasRole } = useAuth()
  const canScore = hasRole('ADMIN', 'ANALYST')
  const canDocs = hasRole('ADMIN', 'COMPLIANCE', 'ANALYST')

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Analyst"
        title="Desk tools"
        subtitle="Score a payment, backfill CSV, or verify a cheque/invoice from the ops desk."
      />

      <div className="grid gap-5 xl:grid-cols-2">
        {canScore && <ScoreTxPanel />}
        {canDocs && <VerifyDocumentPanel />}
        {canScore && <ImportCsvPanel />}
      </div>
    </div>
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
      setError(err instanceof ApiError ? err.message : 'Score failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel className="p-6 md:p-8">
      <h2 className="font-display text-2xl font-bold">Score payment</h2>
      <p className="mt-1 text-sm text-mute">Real-time TX scoring for an existing bank customer.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="External customer ID">
          <input
            className={inputClass}
            value={externalCustomerId}
            onChange={(e) => setExternalCustomerId(e.target.value)}
            required
          />
        </Field>
        <Field label="External transaction ID">
          <input
            className={inputClass}
            value={externalTransactionId}
            onChange={(e) => setExternalTransactionId(e.target.value)}
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Amount">
            <input
              type="number"
              step="0.01"
              min="0.01"
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </Field>
          <Field label="Currency">
            <input className={inputClass} value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </Field>
          <Field label="Channel">
            <input className={inputClass} value={channel} onChange={(e) => setChannel(e.target.value)} />
          </Field>
        </div>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-ember-grad px-6 py-3 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? 'Scoring…' : 'Score now'}
        </button>
      </form>
      {result && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={result.flagged ? 'danger' : 'ok'}>{result.recommendation}</StatusPill>
            <StatusPill tone="neutral">anomaly {pct(result.anomalyScore)}</StatusPill>
            {result.caseId && <StatusPill tone="ember">case #{result.caseId}</StatusPill>}
          </div>
          <p className="mt-3 text-sm text-white/80">{result.explanation}</p>
          {result.ruleFlags?.length > 0 && (
            <p className="mt-2 text-xs text-mute">{result.ruleFlags.join(' · ')}</p>
          )}
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
      setError('Choose a document image')
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
      setError(err instanceof ApiError ? err.message : 'Verify failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel className="p-6 md:p-8">
      <h2 className="font-display text-2xl font-bold">Verify document</h2>
      <p className="mt-1 text-sm text-mute">Cheque or invoice check with optional signature match.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="External customer ID">
          <input
            className={inputClass}
            value={externalCustomerId}
            onChange={(e) => setExternalCustomerId(e.target.value)}
            required
          />
        </Field>
        <Field label="Document type">
          <select
            className={inputClass}
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocumentType)}
          >
            <option value="CHEQUE">CHEQUE</option>
            <option value="INVOICE">INVOICE</option>
            <option value="ID">ID</option>
          </select>
        </Field>
        <Field label="Image">
          <input
            type="file"
            accept="image/*,.pdf"
            className="block w-full text-sm text-white/70 file:mr-4 file:rounded-full file:border-0 file:bg-ember/20 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ember-glow"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </Field>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-ember-grad px-6 py-3 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? 'Verifying…' : 'Verify document'}
        </button>
      </form>
      {result && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5 text-sm">
          <div className="flex flex-wrap gap-2">
            <StatusPill tone="neutral">#{result.id}</StatusPill>
            <StatusPill tone="ember">{result.type}</StatusPill>
            <StatusPill tone="neutral">{result.signatureMatchStatus}</StatusPill>
          </div>
          <p className="mt-3 text-white/80">
            Tampering {pct(result.tamperingScore)} · Fraud {pct(result.fraudRiskScore)}
            {result.signatureMatchScore != null
              ? ` · Signature ${pct(result.signatureMatchScore)}`
              : ''}
          </p>
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
      setError('Choose a CSV file')
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
      setError(err instanceof ApiError ? err.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel className="p-6 md:p-8 xl:col-span-2">
      <h2 className="font-display text-2xl font-bold">Import transactions</h2>
      <p className="mt-1 text-sm text-mute">CSV backfill — live scoring remains the primary path.</p>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field label="CSV file">
            <input
              type="file"
              accept=".csv,text/csv"
              className="block w-full text-sm text-white/70 file:mr-4 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Field>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-ember-grad px-6 py-3 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? 'Importing…' : 'Import CSV'}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      {result && (
        <p className="mt-4 text-sm text-ember-glow">
          Processed {result.processed} · failed {result.failed}
        </p>
      )}
    </Panel>
  )
}
