import { useEffect, useRef, useState } from 'react'
import { request } from './api'
export function useRead<T>(path: string) {
  const [data, setData] = useState<T | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [version, setVersion] = useState(0)
  useEffect(() => {
    let active = true; const controller = new AbortController(); setLoading(true); setError(''); setData(null)
    void request<T>(path, 'GET', undefined, controller.signal).then(value => { if (active) setData(value) })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : 'Unable to load data') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false; controller.abort() }
  }, [path, version])
  return { data, error, loading, reload: () => setVersion(value => value + 1) }
}
export function useAction() {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), running = useRef(false)
  return { busy, error, run: async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    if (running.current) return; running.current = true; setBusy(true); setError('')
    try { return await action() } catch (error) { setError(error instanceof Error ? error.message : 'Could not confirm the change'); return undefined }
    finally { running.current = false; setBusy(false) }
  } }
}
