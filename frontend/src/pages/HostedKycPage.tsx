import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SentinelLogo } from '../components/landing/ui'
import { fileToBase64 } from '../lib/files'

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
}

type Step = 'intro' | 'id' | 'selfie' | 'review' | 'done'

async function hostedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    throw new Error((data && data.message) || res.statusText)
  }
  return data as T
}

export default function HostedKycPage() {
  const { token } = useParams()
  const [session, setSession] = useState<HostedSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<Step>('intro')
  const [name, setName] = useState('')
  const [idPreview, setIdPreview] = useState<string | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
  const [idBase64, setIdBase64] = useState<string | null>(null)
  const [selfieBase64, setSelfieBase64] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const data = await hostedFetch<HostedSession>(`/api/kyc/hosted/${token}`)
      setSession(data)
      if (data.status === 'COMPLETE') setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Session not found')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  async function onPick(
    file: File | null,
    kind: 'id' | 'selfie',
  ) {
    if (!file) return
    const b64 = await fileToBase64(file)
    const preview = URL.createObjectURL(file)
    if (kind === 'id') {
      setIdBase64(b64)
      setIdPreview(preview)
    } else {
      setSelfieBase64(b64)
      setSelfiePreview(preview)
    }
  }

  async function submit() {
    if (!token || !idBase64 || !selfieBase64) return
    setBusy(true)
    setError(null)
    try {
      const data = await hostedFetch<HostedSession>(`/api/kyc/hosted/${token}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          idImage: idBase64,
          selfieImage: selfieBase64,
          name: name.trim() || undefined,
        }),
      })
      setSession(data)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Shell>
        <p className="text-sm text-white/60">Opening secure verification…</p>
      </Shell>
    )
  }

  if (error && !session) {
    return (
      <Shell>
        <h1 className="font-display text-3xl font-black">Link unavailable</h1>
        <p className="mt-3 text-sm text-red-300">{error}</p>
        <Link to="/" className="mt-8 inline-flex text-sm text-ember-glow">
          Back to Sentinel
        </Link>
      </Shell>
    )
  }

  if (!session) return null

  if (session.expired && session.status !== 'COMPLETE') {
    return (
      <Shell>
        <p className="text-xs uppercase tracking-[0.18em] text-white/60">{session.tenantName}</p>
        <h1 className="mt-2 font-display text-4xl font-black">Session expired</h1>
        <p className="mt-4 text-sm text-mute">
          Ask your bank to start a new verification link.
        </p>
      </Shell>
    )
  }

  return (
    <Shell>
      <p className="text-xs uppercase tracking-[0.18em] text-ember-glow">
        Identity check · {session.tenantName}
      </p>
      <h1 className="mt-2 font-display text-4xl font-black tracking-tight md:text-5xl">
        {step === 'done' ? 'Verification submitted' : 'Verify your identity'}
      </h1>
      <p className="mt-3 max-w-md text-sm text-white/70">
        {step === 'done'
          ? 'You can return to your bank. Compliance may review if anything needs a human look.'
          : 'Secure capture powered by Sentinel — your bank started this check for you.'}
      </p>

      {step !== 'done' && (
        <ol className="mt-8 flex flex-wrap gap-2 text-xs uppercase tracking-[0.12em]">
          {(['intro', 'id', 'selfie', 'review'] as Step[]).map((item, index) => (
            <li
              key={item}
              className={[
                'rounded-full px-3 py-1.5',
                step === item ? 'bg-ember/30 text-white' : 'bg-white/5 text-white/45',
              ].join(' ')}
            >
              {index + 1}. {item}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-8">
        {step === 'intro' && (
          <div className="space-y-5">
            <div className="liquid-glass rounded-[24px] p-5 text-sm text-white/80">
              <p>You will:</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-mute">
                <li>Photograph your government ID</li>
                <li>Take a live selfie ({session.livenessHint})</li>
                <li>Submit once — do not refresh mid-check</li>
              </ul>
            </div>
            <Field label="Full name (optional)">
              <input
                className="w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm outline-none focus:border-ember/50"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="As on your ID"
              />
            </Field>
            <PrimaryButton onClick={() => setStep('id')}>Continue</PrimaryButton>
          </div>
        )}

        {step === 'id' && (
          <CaptureStep
            title="Government ID"
            hint="Place the ID inside the frame. Avoid glare."
            preview={idPreview}
            onFile={(file) => void onPick(file, 'id')}
            onBack={() => setStep('intro')}
            onNext={() => setStep('selfie')}
            nextDisabled={!idBase64}
          />
        )}

        {step === 'selfie' && (
          <CaptureStep
            title="Live selfie"
            hint={session.livenessHint || 'Look straight at the camera'}
            preview={selfiePreview}
            preferCamera
            onFile={(file) => void onPick(file, 'selfie')}
            onBack={() => setStep('id')}
            onNext={() => setStep('review')}
            nextDisabled={!selfieBase64}
          />
        )}

        {step === 'review' && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <PreviewCard label="ID" src={idPreview} />
              <PreviewCard label="Selfie" src={selfiePreview} />
            </div>
            {error && <p className="text-sm text-red-300">{error}</p>}
            <div className="flex flex-wrap gap-3">
              <GhostButton onClick={() => setStep('selfie')}>Back</GhostButton>
              <PrimaryButton onClick={() => void submit()} disabled={busy}>
                {busy ? 'Submitting…' : 'Submit verification'}
              </PrimaryButton>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-5">
            <div className="liquid-glass rounded-[24px] p-6">
              <p className="text-xs uppercase tracking-[0.14em] text-white/45">Result</p>
              <p className="mt-2 font-display text-2xl font-bold">
                {session.kycStatus || session.status}
              </p>
              {session.explanation && (
                <p className="mt-3 text-sm text-mute">{session.explanation}</p>
              )}
              {session.riskScore != null && (
                <p className="mt-2 text-sm text-white/70">Risk score {session.riskScore}</p>
              )}
            </div>
            {session.returnUrl ? (
              <a
                href={session.returnUrl}
                className="inline-flex w-full items-center justify-center rounded-full bg-ember-grad px-6 py-3.5 text-sm font-semibold"
              >
                Return to {session.tenantName}
              </a>
            ) : (
              <p className="text-sm text-mute">You can close this window and return to your bank app.</p>
            )}
          </div>
        )}
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-ink text-white">
      <img
        src="/sentinel_hero_bg.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-50"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-ink/85 to-ink" />
      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-lg flex-col px-5 py-8 md:px-8">
        <div className="flex items-center justify-between">
          <SentinelLogo size={36} />
          <span className="text-[11px] uppercase tracking-[0.16em] text-white/45">Hosted KYC</span>
        </div>
        <div className="mt-10 flex-1 animate-fade-up">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
        {label}
      </span>
      {children}
    </label>
  )
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex w-full items-center justify-center rounded-full bg-ember-grad px-6 py-3.5 text-sm font-semibold disabled:opacity-50"
    >
      {children}
    </button>
  )
}

function GhostButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="liquid-glass rounded-full px-6 py-3 text-sm font-medium"
    >
      {children}
    </button>
  )
}

function PreviewCard({ label, src }: { label: string; src: string | null }) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-white/10 bg-black/40">
      <p className="px-4 py-2 text-xs uppercase tracking-[0.14em] text-white/45">{label}</p>
      {src ? (
        <img src={src} alt="" className="aspect-[4/3] w-full object-cover" />
      ) : (
        <div className="grid aspect-[4/3] place-items-center text-sm text-mute">No image</div>
      )}
    </div>
  )
}

function CaptureStep({
  title,
  hint,
  preview,
  preferCamera,
  onFile,
  onBack,
  onNext,
  nextDisabled,
}: {
  title: string
  hint: string
  preview: string | null
  preferCamera?: boolean
  onFile: (file: File | null) => void
  onBack: () => void
  onNext: () => void
  nextDisabled: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraOn, setCameraOn] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: preferCamera ? 'user' : 'environment' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraOn(true)
    } catch {
      setCameraOn(false)
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
    canvas.toBlob((blob) => {
      if (!blob) return
      onFile(new File([blob], `${preferCamera ? 'selfie' : 'id'}.jpg`, { type: 'image/jpeg' }))
      stopCamera()
    }, 'image/jpeg', 0.92)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-bold">{title}</h2>
        <p className="mt-1 text-sm text-mute">{hint}</p>
      </div>

      {cameraOn ? (
        <div className="overflow-hidden rounded-[24px] border border-white/15 bg-black">
          <video ref={videoRef} playsInline muted className="aspect-[3/4] w-full object-cover" />
        </div>
      ) : preview ? (
        <img src={preview} alt="" className="aspect-[3/4] w-full rounded-[24px] object-cover" />
      ) : (
        <div className="grid aspect-[3/4] place-items-center rounded-[24px] border border-dashed border-white/20 bg-black/30 text-sm text-mute">
          Camera or upload
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!cameraOn ? (
          <GhostButton onClick={() => void startCamera()}>Use camera</GhostButton>
        ) : (
          <>
            <PrimaryButton onClick={snap}>Capture</PrimaryButton>
            <GhostButton onClick={stopCamera}>Cancel camera</GhostButton>
          </>
        )}
        <label className="liquid-glass cursor-pointer rounded-full px-6 py-3 text-sm font-medium">
          Upload
          <input
            type="file"
            accept="image/*"
            capture={preferCamera ? 'user' : 'environment'}
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <GhostButton onClick={onBack}>Back</GhostButton>
        <PrimaryButton onClick={onNext} disabled={nextDisabled}>
          Continue
        </PrimaryButton>
      </div>
    </div>
  )
}
