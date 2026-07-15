import type { ReactNode } from 'react'

type LogoProps = {
  className?: string
  showWord?: boolean
  size?: number
}

export function SentinelLogo({ className = '', showWord = true, size = 48 }: LogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 bg-transparent ${className}`}>
      <img
        src="/senitel_logo.png"
        alt={showWord ? '' : 'Sentinel'}
        width={size}
        height={size}
        className="shrink-0 bg-transparent object-contain mix-blend-normal"
        style={{ width: size, height: size }}
        decoding="async"
      />
      {showWord && (
        <span className="font-display text-xl font-normal tracking-tight text-white md:text-2xl">
          Sentinel
        </span>
      )}
    </div>
  )
}

export function ArrowCta({
  children,
  href = '#',
  className = '',
  variant = 'ember',
}: {
  children: ReactNode
  href?: string
  className?: string
  variant?: 'ember' | 'glass'
}) {
  const base =
    variant === 'ember'
      ? 'bg-ember-grad text-white'
      : 'glass text-white'

  return (
    <a
      href={href}
      className={`inline-flex items-center gap-3 rounded-full px-6 py-3.5 text-sm font-semibold transition hover:scale-[1.02] active:scale-[0.98] ${base} ${className}`}
    >
      {children}
      <span className="grid h-8 w-8 place-items-center rounded-full bg-white">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M3 7h8M7 3l4 4-4 4"
            stroke="#FF4515"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </a>
  )
}
