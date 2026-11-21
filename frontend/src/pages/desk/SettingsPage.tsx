import type { FormEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { ApiError, api } from '../../api/client'
import type { RiskSettings, WebhookSettings } from '../../api/types'
import {
  ErrorState,
  Field,
  Notice,
  PageHeader,
  Panel,
  PanelHeader,
  SkeletonRows,
  buttonClass,
  formatWhen,
  inputClass,
} from '../../components/desk/ui'

type Msg = { tone: 'success' | 'error'; text: string } | null

export default function SettingsPage() {
  const [risk, setRisk] = useState<RiskSettings | null>(null)
  const [webhook, setWebhook] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [riskMsg, setRiskMsg] = useState<Msg>(null)
  const [hookMsg, setHookMsg] = useState<Msg>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    Promise.all([
      api.get<RiskSettings>('/api/admin/settings/risk-weights'),
      api.get<WebhookSettings>('/api/admin/settings/webhook'),
    ])
      .then(([weights, hook]) => {
        setRisk(weights)
        setWebhook(hook.webhookUrl || '')
      })
      .catch((err) => setLoadError(err))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function saveRisk(e: FormEvent) {
    e.preventDefault()
    if (!risk) return
    setBusy(true)
    setRiskMsg(null)
    try {
      const updated = await api.put<RiskSettings>('/api/admin/settings/risk-weights', risk)
      setRisk(updated)
      setRiskMsg({ tone: 'success', text: 'Risk settings saved.' })
    } catch (err) {
      setRiskMsg({ tone: 'error', text: err instanceof ApiError ? err.message : 'Risk settings were not saved. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  async function saveWebhook(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setHookMsg(null)
    try {
      await api.put('/api/admin/settings/webhook', { webhookUrl: webhook })
      setHookMsg({ tone: 'success', text: 'Webhook URL saved.' })
    } catch (err) {
      setHookMsg({ tone: 'error', text: err instanceof ApiError ? err.message : 'Webhook URL was not saved. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  async function testWebhook() {
    setBusy(true)
    setHookMsg(null)
    try {
      await api.post('/api/admin/webhooks/test')
      setHookMsg({ tone: 'success', text: 'Test event sent to the webhook URL.' })
    } catch (err) {
      setHookMsg({ tone: 'error', text: err instanceof ApiError ? err.message : 'Test event failed. Check the URL and try again.' })
    } finally {
      setBusy(false)
    }
  }

  const header = <PageHeader title="Settings" subtitle="Risk weights, thresholds and the bank’s outbound webhook for this tenant." />

  if (loading || loadError || !risk) {
    return (
      <div className="space-y-5">
        {header}
        <Panel>
          {loadError ? <ErrorState error={loadError} onRetry={load} what="settings" /> : <SkeletonRows rows={5} label="Loading settings" />}
        </Panel>
      </div>
    )
  }

  const weightFields: Array<{ key: keyof RiskSettings; label: string }> = [
    { key: 'kycWeight', label: 'KYC weight' },
    { key: 'documentWeight', label: 'Document weight' },
    { key: 'transactionWeight', label: 'Transaction weight' },
  ]
  const thresholdFields: Array<{ key: keyof RiskSettings; label: string; max?: number; step?: string }> = [
    { key: 'faceMatchThreshold', label: 'Face match threshold' },
    { key: 'signatureMatchThreshold', label: 'Signature match threshold' },
    { key: 'tamperingThreshold', label: 'Tampering threshold' },
    { key: 'anomalyThreshold', label: 'Payment anomaly threshold' },
    { key: 'autoFlagRiskScore', label: 'Auto-flag at risk score', max: 100 },
  ]
  const weightSum = Number(risk.kycWeight) + Number(risk.documentWeight) + Number(risk.transactionWeight)
  const sumOk = Math.abs(weightSum - 1) < 0.001

  const numberInput = (field: { key: keyof RiskSettings; label: string; max?: number; step?: string }) => (
    <Field key={field.key} label={field.label}>
      <input
        type="number"
        inputMode="decimal"
        step={field.step ?? '0.01'}
        min={0}
        max={field.max ?? 1}
        className={`${inputClass} font-mono tabular-nums`}
        value={Number(risk[field.key])}
        onChange={(e) => setRisk({ ...risk, [field.key]: Number(e.target.value) })}
      />
    </Field>
  )

  return (
    <div className="space-y-5">
      {header}

      <form onSubmit={saveRisk}>
        <Panel labelledBy="risk-settings">
          <PanelHeader
            id="risk-settings"
            title="Risk scoring"
            description={risk.updatedAt ? `Last changed ${formatWhen(risk.updatedAt)}` : undefined}
          />
          <div className="space-y-5 p-4">
            <fieldset>
              <legend className="text-sm font-semibold text-content">Weights</legend>
              <p className={`mt-0.5 text-xs ${sumOk ? 'text-content-subtle' : 'text-risk-review'}`} aria-live="polite">
                The three weights must add up to 1.00. Current total:{' '}
                <span className="font-mono tabular-nums">{weightSum.toFixed(2)}</span>
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">{weightFields.map(numberInput)}</div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold text-content">Thresholds</legend>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{thresholdFields.map(numberInput)}</div>
            </fieldset>
            {riskMsg && <Notice tone={riskMsg.tone}>{riskMsg.text}</Notice>}
            <button type="submit" disabled={busy} className={buttonClass('primary')}>
              Save risk settings
            </button>
          </div>
        </Panel>
      </form>

      <form onSubmit={saveWebhook}>
        <Panel labelledBy="webhook">
          <PanelHeader id="webhook" title="Webhook" />
          <div className="space-y-4 p-4">
            <Field label="Outbound URL" hint="Sentinel posts KYC completion and case events to this address.">
              <input
                type="url"
                className={inputClass}
                value={webhook}
                onChange={(e) => setWebhook(e.target.value)}
                placeholder="https://bank.example/hooks/sentinel"
                autoComplete="url"
              />
            </Field>
            {hookMsg && <Notice tone={hookMsg.tone}>{hookMsg.text}</Notice>}
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy} className={buttonClass('secondary')}>
                Save webhook
              </button>
              <button type="button" onClick={() => void testWebhook()} disabled={busy} className={buttonClass('ghost')}>
                Send test event
              </button>
            </div>
          </div>
        </Panel>
      </form>
    </div>
  )
}
