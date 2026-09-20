import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { ApiError, api } from '../../api/client'
import type { RiskSettings, WebhookSettings } from '../../api/types'
import {
  Field,
  LoadingBlock,
  PageHeader,
  Panel,
  inputClass,
} from '../../components/desk/ui'

export default function SettingsPage() {
  const [risk, setRisk] = useState<RiskSettings | null>(null)
  const [webhook, setWebhook] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get<RiskSettings>('/api/admin/settings/risk-weights'),
      api.get<WebhookSettings>('/api/admin/settings/webhook'),
    ])
      .then(([weights, hook]) => {
        setRisk(weights)
        setWebhook(hook.webhookUrl || '')
      })
      .catch((err) => setMessage(err instanceof Error ? err.message : 'Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  async function saveRisk(e: FormEvent) {
    e.preventDefault()
    if (!risk) return
    setBusy(true)
    setMessage(null)
    try {
      const updated = await api.put<RiskSettings>('/api/admin/settings/risk-weights', risk)
      setRisk(updated)
      setMessage('Risk settings saved')
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function saveWebhook(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await api.put('/api/admin/settings/webhook', { webhookUrl: webhook })
      setMessage('Webhook URL saved')
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Webhook save failed')
    } finally {
      setBusy(false)
    }
  }

  async function testWebhook() {
    setBusy(true)
    setMessage(null)
    try {
      await api.post('/api/admin/webhooks/test')
      setMessage('Test webhook fired')
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Test failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingBlock label="Loading settings…" />
  if (!risk) {
    return <div className="text-sm text-red-300">{message || 'Settings unavailable'}</div>
  }

  const numberFields: Array<{ key: keyof RiskSettings; label: string; max?: number }> = [
    { key: 'kycWeight', label: 'KYC weight' },
    { key: 'documentWeight', label: 'Document weight' },
    { key: 'transactionWeight', label: 'Transaction weight' },
    { key: 'faceMatchThreshold', label: 'Face match threshold' },
    { key: 'signatureMatchThreshold', label: 'Signature threshold' },
    { key: 'tamperingThreshold', label: 'Tampering threshold' },
    { key: 'anomalyThreshold', label: 'Anomaly threshold' },
    { key: 'autoFlagRiskScore', label: 'Auto-flag risk score', max: 100 },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Settings"
        subtitle="Tenant risk weights, thresholds, and outbound bank webhooks."
      />

      {message && (
        <p className="rounded-2xl border border-ember/30 bg-ember/10 px-4 py-3 text-sm text-ember-glow">
          {message}
        </p>
      )}

      <form onSubmit={saveRisk}>
        <Panel className="p-6 md:p-8">
          <h2 className="font-display text-2xl font-bold">Risk weights</h2>
          <p className="mt-1 text-sm text-mute">Weights must sum to 1.0.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {numberFields.map((field) => (
              <Field key={field.key} label={field.label}>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={field.max ?? 1}
                  className={inputClass}
                  value={Number(risk[field.key])}
                  onChange={(e) =>
                    setRisk({
                      ...risk,
                      [field.key]: Number(e.target.value),
                    })
                  }
                />
              </Field>
            ))}
          </div>
          <button
            type="submit"
            disabled={busy}
            className="mt-6 rounded-full bg-ember-grad px-6 py-3 text-sm font-semibold disabled:opacity-50"
          >
            Save risk settings
          </button>
        </Panel>
      </form>

      <form onSubmit={saveWebhook}>
        <Panel className="p-6 md:p-8">
          <h2 className="font-display text-2xl font-bold">Webhook</h2>
          <div className="mt-6">
            <Field label="Outbound URL" hint="Bank endpoint for KYC_COMPLETE / CASE_* events">
              <input
                className={inputClass}
                value={webhook}
                onChange={(e) => setWebhook(e.target.value)}
                placeholder="https://bank.example/hooks/sentinel"
              />
            </Field>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-ember-grad px-6 py-3 text-sm font-semibold disabled:opacity-50"
            >
              Save webhook
            </button>
            <button
              type="button"
              onClick={() => void testWebhook()}
              disabled={busy}
              className="liquid-glass rounded-full px-6 py-3 text-sm font-medium disabled:opacity-50"
            >
              Send test
            </button>
          </div>
        </Panel>
      </form>
    </div>
  )
}
