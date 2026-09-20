/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_WS_URL?: string
  readonly VITE_API_PROXY?: string
  readonly VITE_SITE_URL?: string
  readonly VITE_GA_MEASUREMENT_ID?: string
  readonly VITE_GTM_ID?: string
  readonly VITE_GOOGLE_SITE_VERIFICATION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*Strands/Strands' {
  import type { ComponentType } from 'react'
  const Strands: ComponentType<Record<string, unknown>>
  export default Strands
}

declare module '*Strands/Strands.jsx' {
  import type { ComponentType } from 'react'
  const Strands: ComponentType<Record<string, unknown>>
  export default Strands
}
