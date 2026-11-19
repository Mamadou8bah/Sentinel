import { withKycWarmup, KycTemporaryError, type KycConnectionOptions } from './kycWarmup'
const origin = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
export function loadHostedKyc<T>(token: string, options: KycConnectionOptions = {}): Promise<T> {
  return withKycWarmup(async signal => {
    const response = await fetch(`${origin}/api/kyc/hosted/${encodeURIComponent(token)}`, { signal, headers: { Accept: 'application/json' } })
    if (response.status >= 500) throw new KycTemporaryError()
    if (!response.ok) throw new Error('This verification link could not be opened.')
    return await response.json() as T
  }, options)
}
/** Evidence submission is never automatically replayed after an uncertain write. */
export async function submitHostedKyc<T>(token: string, evidence: unknown): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90000)
  try {
    const response = await fetch(`${origin}/api/kyc/hosted/${encodeURIComponent(token)}/submit`, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(evidence) })
    if (!response.ok) throw new Error('Verification submission could not be confirmed.')
    return await response.json() as T
  } finally { clearTimeout(timer) }
}
