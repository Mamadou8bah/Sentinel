const DEMO_FLAG = 'sentinel.demo'

export type DemoModeSetting = 'auto' | 'true' | 'false'

export function demoSetting(): DemoModeSetting {
  const raw = (import.meta.env.VITE_DEMO_MODE || 'auto').toLowerCase()
  if (raw === 'true' || raw === '1' || raw === 'on') return 'true'
  if (raw === 'false' || raw === '0' || raw === 'off') return 'false'
  return 'auto'
}

export function isDemoForced() {
  return demoSetting() === 'true'
}

export function isDemoDisabled() {
  return demoSetting() === 'false'
}

export function isDemoActive() {
  if (isDemoForced()) return true
  if (isDemoDisabled()) return false
  return localStorage.getItem(DEMO_FLAG) === '1'
}

export function enableDemoMode(reason = 'backend unreachable') {
  if (isDemoDisabled()) return false
  const was = isDemoActive()
  localStorage.setItem(DEMO_FLAG, '1')
  if (!was) {
    window.dispatchEvent(new CustomEvent('sentinel:demo', { detail: { reason } }))
  }
  return true
}

export function disableDemoMode() {
  localStorage.removeItem(DEMO_FLAG)
  window.dispatchEvent(new CustomEvent('sentinel:demo', { detail: { reason: 'disabled' } }))
}

export function isDemoToken(token: string | null | undefined) {
  return Boolean(token && token.startsWith('demo.'))
}
