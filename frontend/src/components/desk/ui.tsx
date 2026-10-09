import type { ReactNode } from 'react'
import type { CaseStatus, KycStatus } from '../../api/types'

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string
  title: ReactNode
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        {eyebrow && (
          <p className="text-sm uppercase tracking-[0.18em] text-fg/70">{eyebrow}</p>
        )}
        <h1 className="mt-1 font-display text-4xl font-black leading-[0.95] tracking-tight text-fg sm:text-5xl">
          {title}
        </h1>
        {subtitle && <p className="mt-3 max-w-xl text-base text-fg/75">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatusPill({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'ember'
  children: ReactNode
}) {
  const tones = {
    neutral: 'border-fg/15 bg-fg/10 text-fg/85 backdrop-blur-sm',
    ok: 'border-emerald-500/35 bg-emerald-500/12 text-[color:var(--status-ok)]',
    warn: 'border-amber-500/35 bg-amber-500/12 text-[color:var(--status-warn)]',
    danger: 'border-red-500/35 bg-red-500/12 text-[color:var(--status-danger)]',
    ember: 'border-ember/40 bg-ember/15 text-[color:var(--status-ember)]',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

export function caseTone(status: CaseStatus): 'neutral' | 'ok' | 'warn' | 'danger' | 'ember' {
  if (status === 'OPEN') return 'ember'
  if (status === 'UNDER_REVIEW') return 'warn'
  return 'ok'
}

export function kycTone(status: KycStatus): 'neutral' | 'ok' | 'warn' | 'danger' | 'ember' {
  if (status === 'VERIFIED') return 'ok'
  if (status === 'FLAGGED') return 'warn'
  if (status === 'REJECTED') return 'danger'
  return 'neutral'
}

export function RiskBar({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score))
  const color =
    clamped >= 70 ? 'bg-ember' : clamped >= 40 ? 'bg-amber-400' : 'bg-emerald-400'
  return (
    <div className="min-w-[5rem]">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="font-display text-lg font-bold text-fg">{clamped}</span>
        <span className="text-[10px] uppercase tracking-wider text-mute">risk</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-fg/10">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  )
}

export function Panel({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`liquid-glass overflow-hidden rounded-[28px] shadow-[var(--desk-panel-shadow)] ${className}`}
    >
      {children}
    </div>
  )
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-fg/55">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-mute">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-2xl border border-fg/15 bg-[color:var(--input-bg)] px-4 py-3 text-sm text-fg outline-none transition placeholder:text-fg/35 focus:border-ember/50 focus:ring-2 focus:ring-ember/20'

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="font-display text-2xl font-bold text-fg">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-mute">{body}</p>
    </div>
  )
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 px-6 py-20 text-sm text-mute">
      <span className="h-2 w-2 animate-pulse rounded-full bg-ember" />
      {label}
    </div>
  )
}

export function Pagination({
  page,
  totalPages,
  total,
  from,
  to,
  onChange,
}: {
  page: number
  totalPages: number
  total: number
  from: number
  to: number
  onChange: (page: number) => void
}) {
  if (total <= 0) return null

  const windowSize = 5
  let start = Math.max(1, page - Math.floor(windowSize / 2))
  const end = Math.min(totalPages, start + windowSize - 1)
  start = Math.max(1, end - windowSize + 1)
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i)

  return (
    <div className="flex flex-col gap-3 border-t border-fg/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <p className="text-xs text-mute">
        Showing <span className="font-semibold text-fg">{from}</span>–
        <span className="font-semibold text-fg">{to}</span> of{' '}
        <span className="font-semibold text-fg">{total}</span>
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="rounded-lg border border-fg/15 px-3 py-1.5 text-xs font-medium text-fg/80 transition hover:bg-fg/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Prev
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={[
              'min-w-[2rem] rounded-lg px-2.5 py-1.5 text-xs font-semibold transition',
              p === page
                ? 'bg-ember-grad text-white'
                : 'border border-fg/15 text-fg/75 hover:bg-fg/5',
            ].join(' ')}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="rounded-lg border border-fg/15 px-3 py-1.5 text-xs font-medium text-fg/80 transition hover:bg-fg/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}

export function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}
