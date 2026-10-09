import { useEffect, useRef, useState } from 'react'

const labels: Record<string, string> = {
  LOOK_FORWARD: 'Look straight at the camera',
  TURN_LEFT: 'Turn your head slowly to your left',
  TURN_RIGHT: 'Turn your head slowly to your right',
}

export function LivenessCapture({ hint, onCapture }: { hint: string; onCapture: (frames: string[]) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const mounted = useRef(true)
  const [frames, setFrames] = useState<string[]>([])
  const [cameraOn, setCameraOn] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const parsed = hint.split(',').map(value => value.trim()).filter(value => value in labels)
  const instructions = parsed.length === 3 ? parsed : ['LOOK_FORWARD', 'TURN_LEFT', 'TURN_RIGHT']

  function stop() {
    stream.current?.getTracks().forEach(track => track.stop())
    stream.current = null
    setCameraOn(false)
  }

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      stream.current?.getTracks().forEach(track => track.stop())
    }
  }, [])

  async function start() {
    if (starting) return
    setStarting(true)
    setError(null)
    setFrames([])
    onCapture([])
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access needs HTTPS or localhost and a supported browser.')
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false })
      if (!mounted.current) { media.getTracks().forEach(track => track.stop()); return }
      stream.current = media
      if (!video.current) throw new Error('Camera preview is unavailable.')
      video.current.srcObject = media
      await video.current.play()
      setCameraOn(true)
    } catch (err) {
      stop()
      if (mounted.current) setError(err instanceof Error ? err.message : 'Could not open camera.')
    } finally {
      if (mounted.current) setStarting(false)
    }
  }

  function capture() {
    const element = video.current
    if (!element || element.readyState < 2 || !element.videoWidth) return
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 640 / element.videoWidth, 640 / element.videoHeight)
    canvas.width = Math.round(element.videoWidth * scale)
    canvas.height = Math.round(element.videoHeight * scale)
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(element, 0, 0, canvas.width, canvas.height)
    const next = [...frames, canvas.toDataURL('image/jpeg', 0.85).split(',')[1]]
    setFrames(next)
    if (next.length === instructions.length) {
      onCapture(next)
      stop()
    }
  }

  return <div className="space-y-4">
    <p className="text-sm text-mute">Follow each prompt and capture a frame. This records the challenge response for verification.</p>
    <video ref={video} playsInline muted className={cameraOn ? 'aspect-[4/3] w-full rounded-2xl bg-black object-cover' : 'hidden'} />
    {cameraOn && <>
      <p role="status" className="font-semibold">{frames.length + 1} of {instructions.length}: {labels[instructions[frames.length]]}</p>
      <button type="button" onClick={capture} className="rounded-full bg-ember-grad px-6 py-3 font-semibold">Capture this step</button>
      <button type="button" onClick={stop} className="ml-3 rounded-full border border-white/20 px-5 py-3">Stop camera</button>
    </>}
    {!cameraOn && <button type="button" disabled={starting} onClick={() => void start()} className="rounded-full border border-white/20 px-6 py-3 disabled:opacity-50">
      {starting ? 'Opening camera…' : frames.length === 3 ? 'Retake challenge' : 'Start camera challenge'}
    </button>}
    {frames.length === 3 && <p role="status" className="text-sm text-white/70">Three challenge frames captured.</p>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
  </div>
}
