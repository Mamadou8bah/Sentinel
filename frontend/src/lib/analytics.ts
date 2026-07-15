/**
 * Google Analytics (gtag) + Google Tag Manager helpers.
 *
 * Enable via Vite env:
 *   VITE_SITE_URL=https://your-domain.com
 *   VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
 *   VITE_GTM_ID=GTM-XXXXXXX
 *   VITE_GOOGLE_SITE_VERIFICATION=optional-search-console-token
 */

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined
const GTM_ID = import.meta.env.VITE_GTM_ID as string | undefined

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

function injectScript(src: string, attrs: Record<string, string> = {}) {
  const script = document.createElement('script')
  script.src = src
  script.async = true
  Object.entries(attrs).forEach(([key, value]) => script.setAttribute(key, value))
  document.head.appendChild(script)
  return script
}

/** Load Google Tag Manager if VITE_GTM_ID is set. */
export function initGoogleTagManager() {
  if (!GTM_ID || document.getElementById('gtm-script')) return

  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({
    'gtm.start': new Date().getTime(),
    event: 'gtm.js',
  })

  const script = document.createElement('script')
  script.id = 'gtm-script'
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`
  document.head.appendChild(script)

  const noscriptHost = document.getElementById('gtm-noscript')
  if (noscriptHost) {
    noscriptHost.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}" height="0" width="0" style="display:none;visibility:hidden" title="Google Tag Manager"></iframe>`
  }
}

/** Load Google Analytics 4 (gtag.js) if VITE_GA_MEASUREMENT_ID is set. */
export function initGoogleAnalytics() {
  if (!GA_ID || document.getElementById('ga-gtag')) return

  injectScript(`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`, { id: 'ga-gtag' })

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args)
  }
  window.gtag('js', new Date())
  window.gtag('config', GA_ID, {
    anonymize_ip: true,
    send_page_view: true,
  })
}

export function trackPageView(path: string, title?: string) {
  if (!GA_ID || !window.gtag) return
  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title ?? document.title,
  })
}

export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (!GA_ID || !window.gtag) return
  window.gtag('event', name, params)
}

export function initAnalytics() {
  initGoogleTagManager()
  initGoogleAnalytics()
}
