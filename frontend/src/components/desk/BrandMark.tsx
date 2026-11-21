/**
 * Desk/KYC brand mark. Deliberately separate from the landing's SentinelLogo
 * so the frozen landing code is never imported by the desk or KYC page.
 */
export function BrandMark({ size = 24, showWord = true }: { size?: number; showWord?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <img
        src="/senitel_logo.png"
        alt={showWord ? '' : 'Sentinel'}
        width={size}
        height={size}
        className="shrink-0 object-contain"
        style={{ width: size, height: size }}
        decoding="async"
      />
      {showWord && <span className="text-[15px] font-semibold text-content">Sentinel</span>}
    </span>
  )
}
