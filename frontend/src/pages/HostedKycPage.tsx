import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { loadHostedKyc, submitHostedKyc, KycSubmissionError } from '../api/hostedKyc'
import { KycConnectionPending } from '../api/kycWarmup'
import { Icon } from '../components/desk/icons'
import { fileToBase64, prepareDocumentPhoto } from '../lib/files'
import { LivenessCapture } from '../components/kyc/LivenessCapture'

type HostedSession = {
  status: 'PENDING' | 'SUBMITTED' | 'COMPLETE'
  tenantName: string
  tenantCode: string
  livenessHint: string
  expiresAt: string
  expired: boolean
  returnUrl: string | null
  explanation: string | null
  kycStatus: string | null
  riskScore: number | null
  accountNameProvided?: boolean
  documentType?: string | null
}

type Step = 'intro' | 'id' | 'selfie' | 'review' | 'done'

const steps: Array<{ key: Exclude<Step, 'done'>; label: string }> = [
  { key: 'intro', label: 'Get ready' },
  { key: 'id', label: 'ID document' },
  { key: 'selfie', label: 'Video check' },
  { key: 'review', label: 'Review and send' },
]

/**
 * Plain-language outcome for the bank's customer. Never shows the raw KYC
 * status, scores or staff wording, and never says "verified": the bank
 * confirms the result itself.
 */
function outcome(session: HostedSession): { title: string; body: string } {
  const bank = session.tenantName || 'Your bank'
  const kyc = (session.kycStatus || '').toUpperCase()
  if (kyc === 'REJECTED') {
    return {
      title: 'Please try again',
      body: `We couldn’t use these photos and video to check your identity. Ask ${bank} for a new link and try again in good light.`,
    }
  }
  if (kyc === 'FLAGGED' || kyc === 'PENDING' || session.status === 'SUBMITTED') {
    return {
      title: 'Under review',
      body: `Thanks, your details were sent. ${bank} is reviewing them and will contact you if they need anything else.`,
    }
  }
  return {
    title: 'Submitted',
    body: `Thanks, your details were sent. ${bank} will confirm the result.`,
  }
}

function formatTime(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return null
  }
}

export default function HostedKycPage() {
  const { token } = useParams()
  const [session, setSession] = useState<HostedSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [waitingTooLong, setWaitingTooLong] = useState(false)
  const loadController = useRef<AbortController | null>(null)
  const [step, setStep] = useState<Step>('intro')
  const [documentType, setDocumentType] = useState('ID_CARD')
  const [idPreview, setIdPreview] = useState<string | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
  const [idBase64, setIdBase64] = useState<string | null>(null)
  const [videoBase64, setVideoBase64] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [slow, setSlow] = useState(false)
  const [submissionStatus, setSubmissionStatus] = useState(0)
  const [expiredLocally, setExpiredLocally] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const firstStep = useRef(true)

  useEffect(() => {
    document.title = 'Identity check'
  }, [])

  useEffect(
    () => () => {
      if (idPreview?.startsWith('blob:')) URL.revokeObjectURL(idPreview)
    },
    [idPreview],
  )

  // Move focus to the step heading when the step changes (not on first load).
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false
      return
    }
    headingRef.current?.focus()
  }, [step])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    setLoadFailed(false); setWaitingTooLong(false); setConnecting(false)
    loadController.current?.abort()
    const controller = new AbortController(); loadController.current = controller
    try {
      const data = await loadHostedKyc<HostedSession>(token, { signal: controller.signal, onRetry: () => { if (!controller.signal.aborted) setConnecting(true) } })
      if (controller.signal.aborted) return
      setSession(data)
      if (data.status === 'COMPLETE' || data.status === 'SUBMITTED') setStep('done')
    } catch (error) {
      if (!controller.signal.aborted) { setLoadFailed(true); setWaitingTooLong(error instanceof KycConnectionPending) }
    } finally {
      if (!controller.signal.aborted) { setLoading(false); setConnecting(false) }
    }
  }, [token])

  useEffect(() => {
    void load()
    return () => loadController.current?.abort()
  }, [load])

  async function onPick(file: File | null) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5_000_000) {
      setError('Choose a JPEG, PNG or WebP photo up to 5 MB.')
      return
    }
    setError(null)
    try {
      const photo = await prepareDocumentPhoto(file)
      const b64 = await fileToBase64(photo)
      setIdBase64(b64)
      setIdPreview(URL.createObjectURL(photo))
    } catch {
      setError('This photo could not be opened. Choose another JPEG, PNG or WebP photo.')
    }
  }

  async function submit() {
    if (!token || !idBase64 || !videoBase64 || !session) return
    if (Date.parse(session.expiresAt) < Date.now()) {
      setExpiredLocally(true)
      return
    }
    setBusy(true)
    setSlow(false)
    setError(null)
    setSubmissionStatus(0)
    const slowTimer = window.setTimeout(() => setSlow(true), 12000)
    try {
      const data = await submitHostedKyc<HostedSession>(token, {
        idImage: idBase64,
        videoBase64,
        documentType,
      })
      setSession(data)
      setStep('done')
      setVideoBase64(null)
      setIdBase64(null)
      setSelfiePreview(null)
    } catch (failure) {
      // Captures are kept so the customer can retry without starting again.
      setError(failure instanceof KycSubmissionError ? failure.message : 'Your submission could not be confirmed. Your photo and video are kept; try again shortly.')
      setSubmissionStatus(failure instanceof KycSubmissionError ? failure.status : 0)
    } finally {
      window.clearTimeout(slowTimer)
      setBusy(false)
      setSlow(false)
    }
  }

  if (loading) {
    return (
      <Shell>
        <p role="status" className="text-base text-content-muted">
          {connecting ? "Connecting to your identity check. This can take about a minute." : "Opening your identity check…"}
        </p>
      </Shell>
    )
  }

  if (loadFailed || !session) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold leading-8">{waitingTooLong ? "Verification is still connecting" : "We couldn’t open this link"}</h1>
        <p className="mt-2 text-base text-content-muted">
          Check your connection and try again. If it still doesn’t open, ask your bank for a new link.
        </p>
        <div className="mt-6">
          <PrimaryButton onClick={() => void load()}>Try again</PrimaryButton>
        </div>
      </Shell>
    )
  }

  const bank = session.tenantName

  if ((session.expired || expiredLocally) && session.status !== 'COMPLETE') {
    return (
      <Shell bank={bank}>
        <h1 className="text-2xl font-semibold leading-8">This link has expired</h1>
        <p className="mt-2 text-base text-content-muted">For your security, links only work for a short time. Ask {bank} for a new one.</p>
        {session.returnUrl && (
          <a href={session.returnUrl} className={`${primaryClass} mt-6`}>
            Return to {bank}
          </a>
        )}
      </Shell>
    )
  }

  const stepIndex = steps.findIndex((s) => s.key === step)
  const expiresAt = formatTime(session.expiresAt)

  if (step === 'done') {
    const o = outcome(session)
    return (
      <Shell bank={bank}>
        <div className="rounded-2xl border border-line bg-surface p-6">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-surface-raised text-content" aria-hidden>
            <Icon name="check" size={20} />
          </span>
          <h1 ref={headingRef} tabIndex={-1} className="mt-4 text-2xl font-semibold leading-8">
            {o.title}
          </h1>
          <p className="mt-2 text-base text-content-muted">{o.body}</p>
        </div>
        <div className="mt-6">
          {session.returnUrl ? (
            <a href={session.returnUrl} className={primaryClass}>
              Return to {bank}
            </a>
          ) : (
            <p className="text-base text-content-muted">You can close this page and go back to {bank}.</p>
          )}
        </div>
      </Shell>
    )
  }

  return (
    <Shell bank={bank}>
      <nav aria-label="Progress">
        <p className="text-sm text-content-muted">
          Step {stepIndex + 1} of {steps.length}
        </p>
        <ol className="mt-2 grid grid-cols-4 gap-1.5">
          {steps.map((s, i) => (
            <li key={s.key} aria-current={i === stepIndex ? 'step' : undefined}>
              <span className={`block h-1 rounded-sm ${i <= stepIndex ? 'bg-accent' : 'bg-line-strong'}`} aria-hidden />
              <span className={`mt-1.5 block text-xs ${i === stepIndex ? 'font-semibold text-content' : 'text-content-subtle'} max-sm:sr-only`}>
                {s.label}
                {i < stepIndex && <span className="sr-only"> (done)</span>}
              </span>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-6">
        {error && step !== 'review' && (
          <p role="alert" className="mb-4 rounded-xl border border-risk-block/40 bg-risk-block/5 px-4 py-3 text-base text-content">
            {error}
          </p>
        )}

        {step === 'intro' && (
          <div className="space-y-6">
            <div>
              <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold leading-8">
                Confirm your identity for {bank}
              </h1>
              <p className="mt-2 text-base text-content-muted">It takes about two minutes. You’ll need:</p>
            </div>
            <ul className="space-y-3 rounded-2xl border border-line bg-surface p-5 text-base">
              <li className="flex gap-3">
                <Icon name="id" size={22} className="mt-0.5 text-content-muted" />
                <span>Your passport, government ID card or driving licence, to photograph</span>
              </li>
              <li className="flex gap-3">
                <Icon name="camera" size={22} className="mt-0.5 text-content-muted" />
                <span>A camera, for a short nine-second video of your face. No sound is recorded.</span>
              </li>
            </ul>
            <p className="text-sm text-content-muted">{session.accountNameProvided ? `${bank} has supplied your account details. You don’t need to enter them again.` : 'Your name will be read from your document. You don’t need to type it here.'}</p>
            {expiresAt && <p className="text-sm text-content-subtle">This link works until {expiresAt}. Please don’t refresh the page during the check.</p>}
            <PrimaryButton onClick={() => setStep('id')}>Start</PrimaryButton>
          </div>
        )}

        {step === 'id' && (
          <CaptureStep
            documentType={documentType}
            onDocumentType={setDocumentType}
            headingRef={headingRef}
            preview={idPreview}
            onFile={(file) => void onPick(file)}
            onBack={() => setStep('intro')}
            onNext={() => setStep('selfie')}
            nextDisabled={!idBase64}
          />
        )}

        {step === 'selfie' && (
          <div className="space-y-6">
            <div>
              <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold leading-8">
                Video check
              </h1>
              <p className="mt-2 text-base text-content-muted">This shows {bank} that a real person is taking part.</p>
            </div>
            <LivenessCapture
              hint={session.livenessHint}
              onCapture={(capture) => {
                setSubmissionStatus(0)
                setError(null)
                setVideoBase64(capture?.videoBase64 ?? null)
                setSelfiePreview(capture?.preview ?? null)
              }}
            />
            <StepNav
              onBack={() => setStep('id')}
              onNext={() => setStep('review')}
              nextDisabled={!videoBase64}
              disabledReason="Record the video to continue."
            />
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-6">
            <div>
              <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold leading-8">
                Check and send
              </h1>
              <p className="mt-2 text-base text-content-muted">Make sure your ID is sharp and your face is clear.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <PreviewCard label={documentType === 'PASSPORT' ? 'Passport' : documentType === 'DRIVING_LICENCE' ? 'Driving licence' : 'ID card'} src={idPreview} onChange={() => setStep('id')} />
              <PreviewCard label="Video check" src={selfiePreview} onChange={() => setStep('selfie')} />
            </div>
            {error && (
              <p role="alert" className="rounded-xl border border-risk-block/40 bg-risk-block/5 px-4 py-3 text-base text-content">
                {error}
              </p>
            )}
            {busy && (
              <p role="status" className="text-sm text-content-muted">
                {slow ? 'Still sending. This can take a minute on a slow connection; please keep this page open.' : 'Sending your details…'}
              </p>
            )}
            <div className="flex gap-3">
              <SecondaryButton onClick={() => setStep('selfie')} disabled={busy}>
                Back
              </SecondaryButton>
              {[404, 409, 410].includes(submissionStatus) && session.returnUrl ? (
                <a href={session.returnUrl} className={primaryClass}>Return to {bank}</a>
              ) : (
                <PrimaryButton onClick={() => {
                  if (submissionStatus === 422) {
                    setVideoBase64(null)
                    setSelfiePreview(null)
                    setStep('selfie')
                  } else void submit()
                }} disabled={busy || [404, 409, 410].includes(submissionStatus)}>
                  {busy ? 'Sending…' : submissionStatus === 422 ? 'Record again' : [404, 409, 410].includes(submissionStatus) ? 'Request a new link in your app' : error ? 'Try sending again' : 'Send to ' + bank}
                </PrimaryButton>
              )}
            </div>
          </div>
        )}
      </div>
    </Shell>
  )
}

function Shell({ children, bank }: { children: ReactNode; bank?: string }) {
  const demo =
    typeof window !== 'undefined' &&
    ((() => {
      try {
        return localStorage.getItem('sentinel.demo') === '1'
      } catch {
        return false
      }
    })() ||
      import.meta.env.VITE_DEMO_MODE === 'true')
  return (
    <div data-surface="kyc" className="flex min-h-[100svh] flex-col bg-surface-page text-content">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-lg items-center px-5">
          <span className="text-base font-semibold">{bank ?? 'Identity check'}</span>
        </div>
      </header>
      {demo && (
        <p role="note" className="border-b border-line bg-surface-raised px-5 py-2 text-center text-sm text-content-muted">
          <span className="font-semibold text-content">Demo.</span> Sample session; no real identity check is made.
        </p>
      )}
      <main className="mx-auto w-full max-w-lg flex-1 px-5 py-8 s-enter">{children}</main>
      <footer className="mx-auto w-full max-w-lg px-5 pb-8 text-sm text-content-subtle">
        Identity check provided by Sentinel for {bank ?? 'your bank'}.
      </footer>
    </div>
  )
}

const inputClass =
  'h-12 w-full rounded-xl border border-control bg-surface px-4 text-base text-content placeholder:text-content-subtle'

const primaryClass =
  'inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-accent px-6 text-base font-semibold text-accent-on transition-[background-color,transform] duration-150 hover:bg-accent/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50'

const secondaryClass =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-5 text-base font-medium text-content transition-[background-color,transform] duration-150 hover:bg-surface-raised active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50'

function Field({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-content">
        {label}
      </label>
      {children}
    </div>
  )
}

function PrimaryButton({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={primaryClass}>
      {children}
    </button>
  )
}

function SecondaryButton({
  children,
  onClick,
  disabled,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${secondaryClass} ${className}`}>
      {children}
    </button>
  )
}

function StepNav({
  onBack,
  onNext,
  nextDisabled,
  disabledReason,
}: {
  onBack: () => void
  onNext: () => void
  nextDisabled: boolean
  disabledReason: string
}) {
  return (
    <div className="space-y-2">
      {nextDisabled && (
        <p id="next-reason" className="text-sm text-content-subtle">
          {disabledReason}
        </p>
      )}
      <div className="flex gap-3">
        <SecondaryButton onClick={onBack}>Back</SecondaryButton>
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          aria-describedby={nextDisabled ? 'next-reason' : undefined}
          className={primaryClass}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

function PreviewCard({ label, src, onChange }: { label: string; src: string | null; onChange: () => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      {src ? (
        <img src={src} alt={label} className="aspect-[4/3] w-full object-cover" />
      ) : (
        <div className="grid aspect-[4/3] place-items-center bg-surface-raised text-sm text-content-subtle">No preview</div>
      )}
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="text-sm font-medium">{label}</span>
        <button type="button" onClick={onChange} className="min-h-11 rounded-lg px-2 text-sm font-medium text-content underline underline-offset-2">
          Change<span className="sr-only"> {label}</span>
        </button>
      </div>
    </div>
  )
}

/** Landscape ID frame guide drawn over the camera preview. */
function IdFrameGuide() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden>
      <defs>
        <mask id="id-cutout">
          <rect width="300" height="200" fill="white" />
          <rect x="30" y="35" width="240" height="130" rx="10" fill="black" />
        </mask>
      </defs>
      <rect width="300" height="200" fill="rgb(0 0 0 / 0.45)" mask="url(#id-cutout)" />
      <rect x="30" y="35" width="240" height="130" rx="10" fill="none" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function CaptureStep({
  documentType,
  onDocumentType,
  headingRef,
  preview,
  onFile,
  onBack,
  onNext,
  nextDisabled,
}: {
  documentType: string
  onDocumentType: (value: string) => void
  headingRef: React.RefObject<HTMLHeadingElement>
  preview: string | null
  onFile: (file: File | null) => void
  onBack: () => void
  onNext: () => void
  nextDisabled: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function startCamera() {
    setCameraError(null)
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException('unsupported', 'NotSupportedError')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraOn(true)
    } catch (err) {
      setCameraOn(false)
      const name = err instanceof DOMException ? err.name : ''
      setCameraError(
        name === 'NotAllowedError'
          ? 'Camera access is blocked. Allow the camera in your browser settings, or upload a photo of your ID instead.'
          : name === 'NotFoundError'
            ? 'We couldn’t find a camera. Upload a photo of your ID instead.'
            : 'The camera didn’t start. Upload a photo of your ID instead.',
      )
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraOn(false)
  }

  function snap() {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        onFile(new File([blob], 'id.jpg', { type: 'image/jpeg' }))
        stopCamera()
      },
      'image/jpeg',
      0.92,
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold leading-8">
          Photograph your ID
        </h1>
        <p className="mt-2 text-base text-content-muted">
          Lay your document flat in good light. For a passport, use the photo page. Keep all edges visible and avoid glare.
        </p>
      </div>

      <Field label="Document type" htmlFor="kyc-document-type">
        <select id="kyc-document-type" className={inputClass} value={documentType} onChange={event => onDocumentType(event.target.value)}>
          <option value="ID_CARD">ID card</option>
          <option value="PASSPORT">Passport</option>
          <option value="DRIVING_LICENCE">Driving licence</option>
        </select>
      </Field>
      <p className="text-sm text-content-subtle">JPEG, PNG or WebP, up to 5 MB.</p>

      <div className={cameraOn ? 'relative overflow-hidden rounded-2xl bg-black' : 'hidden'}>
        <video ref={videoRef} playsInline muted className="aspect-[3/2] w-full object-cover" />
        <IdFrameGuide />
      </div>
      {!cameraOn &&
        (preview ? (
          <img src={preview} alt="Your ID photo" className="aspect-[3/2] w-full rounded-2xl border border-line bg-surface-raised object-contain" />
        ) : (
          <div className="relative grid aspect-[3/2] place-items-center rounded-2xl border border-dashed border-control bg-surface text-content-subtle">
            <span className="flex flex-col items-center gap-2 text-sm">
              <Icon name="id" size={32} />
              No photo yet
            </span>
          </div>
        ))}

      {cameraError && (
        <p role="alert" className="rounded-xl border border-risk-block/40 bg-risk-block/5 px-4 py-3 text-base text-content">
          {cameraError}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {!cameraOn ? (
          <SecondaryButton onClick={() => void startCamera()}>
            <Icon name="camera" size={20} />
            {preview ? 'Retake' : 'Use camera'}
          </SecondaryButton>
        ) : (
          <>
            <PrimaryButton onClick={snap}>Take photo</PrimaryButton>
            <SecondaryButton onClick={stopCamera}>Stop camera</SecondaryButton>
          </>
        )}
        {!cameraOn && (
          <>
            {/* Visually hidden but focusable input; the button below opens it. */}
            <input
              ref={fileRef}
              id="id-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              tabIndex={-1}
              aria-hidden
              className="sr-only"
              onChange={(e) => {
                onFile(e.target.files?.[0] ?? null)
                e.target.value = ''
              }}
            />
            <SecondaryButton onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={20} />
              Upload photo
            </SecondaryButton>
          </>
        )}
      </div>

      <StepNav onBack={onBack} onNext={onNext} nextDisabled={nextDisabled} disabledReason="Add a photo of your ID to continue." />
    </div>
  )
}
