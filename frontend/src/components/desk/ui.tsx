import { useEffect, useId, type ReactNode } from 'react'
import { ApiError } from '../../api/client'

/* ------------------------------------------------------------------ */
/* Risk semantics: one tone + label map for every verdict and status.  */
/* Colour is never the only signal: each tone has its own marker shape */
/* and a human label.                                                   */
/* ------------------------------------------------------------------ */

export type RiskTone = 'allow' | 'review' | 'block' | 'pending' | 'muted'

const TONES: Record<Exclude<RiskTone, 'muted'>, string[]> = {
  allow: ['ALLOW', 'VERIFIED', 'APPROVE', 'APPROVED', 'SCORED', 'COMPLETE', 'ENROLLED'],
  review: ['REVIEW', 'FLAGGED', 'ESCALATE', 'ESCALATED', 'UNDER_REVIEW', 'FLAG'],
  block: ['BLOCK', 'REJECTED', 'REJECT', 'FAILED', 'DECLINE', 'DECLINED'],
  pending: ['PENDING', 'OPEN', 'SUBMITTED'],
}

const LABELS: Record<string, string> = {
  ALLOW: 'Allow',
  REVIEW: 'Review',
  BLOCK: 'Block',
  PENDING: 'Pending',
  VERIFIED: 'Verified',
  FLAGGED: 'Flagged',
  REJECTED: 'Rejected',
  OPEN: 'Open',
  UNDER_REVIEW: 'Under review',
  RESOLVED: 'Resolved',
  APPROVE: 'Approved',
  REJECT: 'Rejected',
  ESCALATE: 'Escalated',
  SCORED: 'Signature scored',
  SKIPPED_NO_REFERENCE: 'No specimen on file',
  COMPLETE: 'Complete',
  FAILED: 'Failed',
  CHEQUE: 'Cheque',
  INVOICE: 'Invoice',
  ID: 'ID document',
  ADMIN: 'Admin',
  COMPLIANCE: 'Compliance',
  ANALYST: 'Analyst',
}

export function riskTone(value: string | null | undefined): RiskTone {
  if (!value) return 'muted'
  const key = value.toUpperCase()
  for (const [tone, values] of Object.entries(TONES)) {
    if (values.includes(key)) return tone as RiskTone
  }
  return 'muted'
}

export function riskLabel(value: string | null | undefined): string {
  if (!value) return 'Not available'
  if (LABELS[value]) return LABELS[value]
  const text = value.toLowerCase().replaceAll('_', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** 0–100 score bands. Backend thresholds stay authoritative for decisions. */
export function scoreBand(score: number): 'ALLOW' | 'REVIEW' | 'BLOCK' {
  if (score >= 70) return 'BLOCK'
  if (score >= 40) return 'REVIEW'
  return 'ALLOW'
}

const toneText: Record<RiskTone, string> = {
  allow: 'text-risk-allow',
  review: 'text-risk-review',
  block: 'text-risk-block',
  pending: 'text-risk-pending',
  muted: 'text-content-muted',
}

const toneTint: Record<RiskTone, string> = {
  allow: 's-tint-allow',
  review: 's-tint-review',
  block: 's-tint-block',
  pending: 's-tint-pending',
  muted: 'bg-surface-raised',
}

const toneBar: Record<RiskTone, string> = {
  allow: 'bg-risk-allow',
  review: 'bg-risk-review',
  block: 'bg-risk-block',
  pending: 'bg-risk-pending',
  muted: 'bg-content-subtle',
}

/** Marker shape per tone: circle, triangle, square, hollow circle, dash. */
export function ToneMarker({ tone, className = '' }: { tone: RiskTone; className?: string }) {
  const cls = `inline-block h-2 w-2 shrink-0 ${toneText[tone]} ${className}`
  switch (tone) {
    case 'allow':
      return (
        <svg className={cls} viewBox="0 0 8 8" aria-hidden>
          <circle cx="4" cy="4" r="4" fill="currentColor" />
        </svg>
      )
    case 'review':
      return (
        <svg className={cls} viewBox="0 0 8 8" aria-hidden>
          <path d="M4 0.4 7.8 7.6H0.2z" fill="currentColor" />
        </svg>
      )
    case 'block':
      return (
        <svg className={cls} viewBox="0 0 8 8" aria-hidden>
          <rect width="7" height="7" x="0.5" y="0.5" fill="currentColor" />
        </svg>
      )
    case 'pending':
      return (
        <svg className={cls} viewBox="0 0 8 8" aria-hidden>
          <circle cx="4" cy="4" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      )
    default:
      return (
        <svg className={cls} viewBox="0 0 8 8" aria-hidden>
          <rect x="0.5" y="3.2" width="7" height="1.6" fill="currentColor" />
        </svg>
      )
  }
}

/** Status: marker + human label. Used for KYC, case, decision and recommendation values. */
export function Status({
  value,
  label,
  tone,
}: {
  value: string | null | undefined
  label?: string
  tone?: RiskTone
}) {
  const t = tone ?? riskTone(value)
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ${toneTint[t]} ${toneText[t]}`}
      data-status={value ?? ''}
    >
      <ToneMarker tone={t} />
      {label ?? riskLabel(value)}
    </span>
  )
}

/** Decision stamp: squared mono label with a 1px rule, "Review · 62". */
export function Stamp({ value, score, label }: { value: string; score?: number | null; label?: string }) {
  const t = riskTone(value)
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-current px-1.5 py-0.5 font-mono text-xs font-medium tabular-nums ${toneText[t]}`}
    >
      <ToneMarker tone={t} />
      {label ?? riskLabel(value)}
      {score != null && <span aria-hidden>·</span>}
      {score != null && <span>{Math.round(score)}</span>}
    </span>
  )
}

/** Score cell: "62 · Review" with a thin band bar; always text, never colour alone. */
export function Score({ score, showBar = true }: { score: number | null | undefined; showBar?: boolean }) {
  if (score == null || Number.isNaN(score)) {
    return <span className="text-content-subtle">Not available</span>
  }
  const clamped = Math.max(0, Math.min(100, Math.round(score)))
  const band = scoreBand(clamped)
  const t = riskTone(band)
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums">
        <span className="font-mono text-sm font-medium text-content">{clamped}</span>
        <span className={`inline-flex items-center gap-1 text-xs ${toneText[t]}`}>
          <ToneMarker tone={t} />
          {riskLabel(band)}
        </span>
      </span>
      {showBar && (
        <span className="block h-1 w-20 overflow-hidden rounded-sm bg-surface-raised" aria-hidden>
          <span className={`block h-full ${toneBar[t]}`} style={{ width: `${clamped}%` }} />
        </span>
      )}
    </span>
  )
}

/** Verdict scale: 0–100 with Allow / Review / Block bands and a marker. */
export function ScoreScale({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)))
  const band = scoreBand(clamped)
  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[2.5rem] font-medium leading-[1.1] tabular-nums text-content">
          {clamped}
        </span>
        <Stamp value={band} />
      </div>
      <div className="relative mt-3" aria-hidden>
        <div className="flex h-1.5 overflow-hidden rounded-sm">
          <span className="w-[40%] bg-risk-allow/60" />
          <span className="w-[30%] bg-risk-review/60" />
          <span className="w-[30%] bg-risk-block/60" />
        </div>
        <span
          className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-sm bg-content"
          style={{ left: `${clamped}%` }}
        />
        <div className="mt-1.5 flex justify-between font-mono text-[11px] tabular-nums text-content-subtle">
          <span>0</span>
          <span className="ml-[36%]">40</span>
          <span className="ml-[22%]">70</span>
          <span>100</span>
        </div>
      </div>
      <p className="sr-only">
        Risk score {clamped} out of 100, {riskLabel(band)} band.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Layout primitives                                                    */
/* ------------------------------------------------------------------ */

export function PageHeader({
  meta,
  title,
  subtitle,
  actions,
}: {
  meta?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 max-w-3xl">
        {meta && <p className="mb-1 text-xs font-medium text-content-subtle">{meta}</p>}
        <h1 tabIndex={-1} className="text-xl font-semibold leading-7 text-content outline-none">
          {title}
        </h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-content-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function Panel({
  children,
  className = '',
  as: Tag = 'section',
  labelledBy,
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div'
  labelledBy?: string
}) {
  return (
    <Tag
      aria-labelledby={labelledBy}
      className={`overflow-clip rounded-xl border border-line bg-surface shadow-surface ${className}`}
    >
      {children}
    </Tag>
  )
}

export function PanelHeader({
  id,
  title,
  description,
  actions,
}: {
  id?: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
      <div className="min-w-0">
        <h2 id={id} className="text-[15px] font-semibold leading-[22px] text-content">
          {title}
        </h2>
        {description && <p className="text-xs text-content-subtle">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Field({
  label,
  children,
  hint,
  error,
  htmlFor,
}: {
  label: string
  children: ReactNode
  hint?: string
  error?: string | null
  htmlFor?: string
}) {
  const Tag = htmlFor ? 'div' : 'label'
  return (
    <Tag className="block">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-content-muted">
          {label}
        </label>
      ) : (
        <span className="mb-1.5 block text-xs font-medium text-content-muted">{label}</span>
      )}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-content-subtle">{hint}</span>}
      {error && (
        <span className="mt-1 flex items-center gap-1.5 text-xs text-risk-block">
          <ToneMarker tone="block" />
          {error}
        </span>
      )}
    </Tag>
  )
}

export const inputClass =
  'w-full rounded-lg border border-control bg-surface px-3 py-2 text-sm text-content transition-colors placeholder:text-content-subtle focus-visible:border-accent-ink disabled:opacity-60'

export const fileInputClass =
  'block w-full text-sm text-content-muted file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-solid file:border-line-strong file:bg-surface-raised file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-content'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

export function buttonClass(variant: ButtonVariant = 'secondary', size: 'sm' | 'md' = 'md') {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100'
  const sizes = { sm: 'h-8 px-3 text-xs', md: 'h-9 px-4 text-sm' }
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-accent text-accent-on hover:bg-accent/90',
    secondary: 'border border-line-strong bg-surface-raised text-content hover:border-control',
    danger: 'border border-risk-block bg-surface text-risk-block hover:bg-risk-block/10',
    ghost: 'text-content-muted hover:bg-surface-raised hover:text-content',
  }
  return `${base} ${sizes[size]} ${variants[variant]}`
}

/** Segmented control / filter group. Uses aria-pressed so state is announced. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={[
              'h-7 rounded-md px-2.5 text-xs font-medium transition-colors',
              active
                ? 'bg-surface-raised text-content shadow-[inset_0_0_0_1px_var(--s-line-strong)]'
                : 'text-content-muted hover:text-content',
            ].join(' ')}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* States                                                               */
/* ------------------------------------------------------------------ */

export function SkeletonRows({ rows = 6, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="divide-y divide-line">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3" aria-hidden>
          <span className="s-shimmer h-3 w-40 rounded bg-surface-raised" />
          <span className="s-shimmer hidden h-3 w-24 rounded bg-surface-raised sm:block" />
          <span className="s-shimmer ml-auto h-3 w-12 rounded bg-surface-raised" />
        </div>
      ))}
    </div>
  )
}

/** Kept for existing callers: a skeleton block with an accessible label. */
export function LoadingBlock({ label = 'Loading' }: { label?: string }) {
  return <SkeletonRows rows={4} label={label.replace(/…$/, '')} />
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-[15px] font-semibold text-content">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-md text-sm text-content-muted">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export function describeError(err: unknown): {
  kind: 'forbidden' | 'expired' | 'notfound' | 'offline' | 'error'
  message: string
} {
  if (err instanceof ApiError) {
    if (err.status === 403) return { kind: 'forbidden', message: err.message }
    if (err.status === 401) return { kind: 'expired', message: err.message }
    if (err.status === 404) return { kind: 'notfound', message: err.message }
    if (err.status === 503) return { kind: 'offline', message: err.message }
  }
  return { kind: 'error', message: err instanceof Error ? err.message : String(err ?? 'Unknown error') }
}

export function PermissionDenied({ need }: { need?: string }) {
  return (
    <div role="alert" className="px-6 py-12 text-center">
      <p className="text-[15px] font-semibold text-content">You don’t have access to this page</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-content-muted">
        {need ? `It needs the ${need} role. ` : ''}Ask a tenant admin if you need access.
      </p>
    </div>
  )
}

/** Recoverable error with Retry; maps 403/401/404/offline to their own copy. */
export function ErrorState({
  error,
  onRetry,
  what = 'this page',
}: {
  error: unknown
  onRetry?: () => void
  what?: string
}) {
  const info = describeError(error)
  if (info.kind === 'forbidden') return <PermissionDenied />
  const title =
    info.kind === 'expired'
      ? 'Your session has expired'
      : info.kind === 'notfound'
        ? `We couldn’t find ${what}`
        : info.kind === 'offline'
          ? 'Sentinel is unreachable'
          : `We couldn’t load ${what}`
  const body =
    info.kind === 'expired'
      ? 'Sign in again to continue.'
      : info.kind === 'offline'
        ? 'Check your connection, then try again.'
        : info.message
  return (
    <div role="alert" className="px-6 py-12 text-center">
      <p className="inline-flex items-center gap-2 text-[15px] font-semibold text-content">
        <ToneMarker tone="block" />
        {title}
      </p>
      <p className="mx-auto mt-1 max-w-md text-sm text-content-muted">{body}</p>
      {onRetry && info.kind !== 'notfound' && info.kind !== 'expired' && (
        <button type="button" onClick={onRetry} className={`${buttonClass('secondary')} mt-4`}>
          Try again
        </button>
      )}
    </div>
  )
}

/** Inline message announced to assistive tech. */
export function Notice({
  tone,
  children,
  className = '',
}: {
  tone: 'success' | 'error' | 'info'
  children: ReactNode
  className?: string
}) {
  const t: RiskTone = tone === 'success' ? 'allow' : tone === 'error' ? 'block' : 'pending'
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-lg border border-line px-3 py-2 text-sm text-content ${toneTint[t]} ${className}`}
    >
      <ToneMarker tone={t} className="mt-1.5" />
      <span>{children}</span>
    </p>
  )
}

/* ------------------------------------------------------------------ */
/* Pagination                                                           */
/* ------------------------------------------------------------------ */

export function Pagination({
  page,
  totalPages,
  total,
  from,
  to,
  onChange,
  label = 'Pagination',
}: {
  page: number
  totalPages: number
  total: number
  from: number
  to: number
  onChange: (page: number) => void
  label?: string
}) {
  if (total <= 0) return null

  const windowSize = 5
  let start = Math.max(1, page - Math.floor(windowSize / 2))
  const end = Math.min(totalPages, start + windowSize - 1)
  start = Math.max(1, end - windowSize + 1)
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i)

  return (
    <nav
      aria-label={label}
      className="flex flex-col gap-2 border-t border-line px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-xs tabular-nums text-content-subtle">
        {from}–{to} of {total}
      </p>
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
            className={buttonClass('ghost', 'sm')}
          >
            Previous
          </button>
          {pages.map((p) => (
            <button
              key={p}
              type="button"
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Page ${p}`}
              onClick={() => onChange(p)}
              className={[
                'h-8 min-w-8 rounded-md px-2 font-mono text-xs tabular-nums transition-colors',
                p === page
                  ? 'bg-surface-raised font-semibold text-content shadow-[inset_0_0_0_1px_var(--s-line-strong)]'
                  : 'text-content-muted hover:bg-surface-raised hover:text-content',
              ].join(' ')}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onChange(page + 1)}
            className={buttonClass('ghost', 'sm')}
          >
            Next
          </button>
        </div>
      )}
    </nav>
  )
}

/* ------------------------------------------------------------------ */
/* Formatting + misc                                                    */
/* ------------------------------------------------------------------ */

export function formatWhen(iso: string | null | undefined) {
  if (!iso) return 'Not available'
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function formatMoney(amount: number | null | undefined, currency: string | null | undefined) {
  if (amount == null || Number.isNaN(amount)) return 'Not available'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      currencyDisplay: 'code',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency ?? ''}`.trim()
  }
}

/** 0–1 score as a percentage, or "Not available". */
export function formatPct(score: number | null | undefined) {
  if (score == null || Number.isNaN(score)) return 'Not available'
  return `${Math.round(score * 100)}%`
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Sentinel desk`
  }, [title])
}

/** Small definition list row for evidence and identity panels. */
export function DataRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-b-0">
      <dt className="text-sm text-content-muted">{label}</dt>
      <dd className="text-right text-sm tabular-nums text-content">{children}</dd>
    </div>
  )
}

export function useFieldId(prefix: string) {
  return `${prefix}-${useId().replace(/:/g, '')}`
}
