import { withKycWarmup, KycTemporaryError, type KycConnectionOptions } from './kycWarmup'
// Evidence goes directly to the API, avoiding an extra frontend upload proxy.
const origin = (import.meta.env.VITE_HOSTED_KYC_API_BASE_URL || import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
export class KycSubmissionError extends Error {
  constructor(message: string, public readonly status: number) { super(message) }
}
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
  const timer = setTimeout(() => controller.abort(), 150000)
  try {
    const response = await fetch(`${origin}/api/kyc/hosted/${encodeURIComponent(token)}/submit`, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(evidence) })
    if (!response.ok) {
      const messages: Record<number, string> = {
        400: 'The details could not be read. Check your document photo and record the video again.',
        404: 'This verification session is no longer available. Return to your app for a new link.',
        409: 'This session is already bound to another recording. Return to your app for a new link.',
        410: 'This verification link has expired. Return to your app for a new link.',
        413: 'The upload is too large. Use a document photo up to 5 MB and record the video again.',
        422: 'The recording could not be checked. Keep one face visible and follow all three prompts, then record again.',
        429: 'Too many attempts. Wait a moment before sending again.',
        503: 'Identity checks are temporarily unavailable. Your photo and video are kept; try sending again shortly.',
      }
      throw new KycSubmissionError(messages[response.status] || 'The verification service could not confirm your submission. Your photo and video are kept.', response.status)
    }
    return await response.json() as T
  } catch (error) {
    // Check an uncertain outcome before offering another write. Never replay the POST.
    if (!(error instanceof KycSubmissionError) || error.status >= 500) {
      try {
        const latest = await loadHostedKyc<{status:string}>(token, { deadline: Date.now() + 15000 })
        if (latest.status === 'COMPLETE' || latest.status === 'SUBMITTED') return latest as T
      } catch { /* The captures remain in memory while the service reconnects. */ }
    }
    if (error instanceof KycSubmissionError) throw error
    throw new KycSubmissionError('We couldn’t confirm receipt yet. Your photo and video are kept. Check your connection, then try sending again.', 0)
  } finally { clearTimeout(timer) }
}
