import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteUrl = (env.VITE_SITE_URL || 'https://sentinel.app').replace(/\/$/, '')
  const gsc = env.VITE_GOOGLE_SITE_VERIFICATION || ''
  const ogVersion = env.VITE_OG_VERSION || String(Date.now())

  return {
    plugins: [
      react(),
      {
        name: 'sentinel-html-env',
        transformIndexHtml(html) {
          let next = html
            .replaceAll('__SITE_URL__', siteUrl)
            .replaceAll('__OG_VERSION__', ogVersion)
          if (gsc) {
            next = next.replace(
              '<!-- Google Search Console verification (optional) -->\n    <!-- Set VITE_GOOGLE_SITE_VERIFICATION in .env — injected below when present -->',
              `<meta name="google-site-verification" content="${gsc}" />`,
            )
          }
          return next
        },
      },
    ],
    server: { port: 5173 },
  }
})
