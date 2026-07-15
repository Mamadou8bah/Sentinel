import FloatingLines from '../FloatingLines/FloatingLines'
import { ArrowCta } from './ui'

const tiles = [
  { src: '/images/scan-face.png', className: 'left-[6%] top-[18%] animate-float' },
  { src: '/images/cheque.png', className: 'left-[10%] bottom-[22%] animate-float-delayed' },
  { src: '/images/dashboard.png', className: 'right-[8%] top-[16%] animate-float-delayed' },
  { src: '/images/guardian.png', className: 'right-[6%] bottom-[20%] animate-float' },
]

const floatingLinesGradient = ['#C62800', '#FF4515', '#FF6A2A', '#FF4515']

export default function CinematicCta() {
  return (
    <section className="relative overflow-hidden bg-ink px-4 py-20 sm:px-5 sm:py-24 md:px-8 md:py-32">
      <div className="relative mx-auto w-full max-w-7xl overflow-hidden rounded-[28px] sm:rounded-[36px] md:rounded-[44px] lg:max-w-6xl">
        <div className="absolute inset-0 z-0" aria-hidden>
          <FloatingLines
            linesGradient={floatingLinesGradient}
            enabledWaves={['top', 'middle', 'bottom']}
            lineCount={[10, 15, 20]}
            lineDistance={[8, 6, 4]}
            bendRadius={0.4}
            bendStrength={-3.2}
            mouseDamping={0.18}
            parallaxStrength={0.4}
            animationSpeed={1}
            hoverAnimationSpeed={6}
            interactive
            parallax
            mixBlendMode="screen"
          />
        </div>

        <div
          className="pointer-events-none absolute inset-x-[-10%] top-0 z-[1] h-28 rounded-[100%] bg-ember/25 blur-2xl sm:h-40"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-[-10%] bottom-0 z-[1] h-28 rounded-[100%] bg-ember/20 blur-2xl sm:h-40"
          aria-hidden
        />

        {tiles.map((tile) => (
          <img
            key={tile.src + tile.className}
            src={tile.src}
            alt=""
            className={`pointer-events-none absolute z-[2] hidden h-24 w-32 rounded-2xl object-cover opacity-90 shadow-glass md:block lg:h-28 lg:w-40 ${tile.className}`}
          />
        ))}

        <div className="relative z-10 mx-auto max-w-3xl px-2 py-4 text-center sm:py-6 md:py-8">
          <h2 className="font-display text-[2rem] font-black leading-tight sm:text-4xl md:text-6xl">
            From identity to integrity
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-white/75 sm:mt-5 md:text-base">
            &ldquo;Securing banking workflows through real-time document verification, anomaly
            detection, and auditable decisions.&rdquo;
          </p>
          <div className="mt-7 flex justify-center sm:mt-8">
            <ArrowCta href="#contact" className="w-full max-w-xs justify-center sm:w-auto">
              Get Started
            </ArrowCta>
          </div>
        </div>
      </div>
    </section>
  )
}
