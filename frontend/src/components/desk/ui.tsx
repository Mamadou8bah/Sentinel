import type { ReactNode } from 'react'
import type { CaseStatus, KycStatus } from '../../api/types'

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ember-glow">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-white md:text-5xl">
          {title}
        </h1>
        {subtitle && <p className="mt-2 max-w-xl text-sm text-mute md:text-base">{subtitle}</p>}
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
    neutral: 'border-white/15 bg-white/5 text-white/80',
    ok: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    warn: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    danger: 'border-red-400/30 bg-red-400/10 text-red-300',
    ember: 'border-ember/40 bg-ember/15 text-ember-glow',
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
        <span className="font-display text-lg font-bold text-white">{clamped}</span>
        <span className="text-[10px] uppercase tracking-wider text-mute">risk</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
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
    <div className={`rounded-[24px] border border-white/10 bg-panel/80 ${className}`}>
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
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-mute">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-ember/50 focus:ring-2 focus:ring-ember/20'

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="font-display text-2xl font-bold text-white">{title}</p>
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
