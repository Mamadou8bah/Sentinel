/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--ink-rgb) / <alpha-value>)',
        panel: 'rgb(var(--panel-rgb) / <alpha-value>)',
        mute: 'rgb(var(--mute-rgb) / <alpha-value>)',
        light: 'rgb(var(--fg-rgb) / <alpha-value>)',
        fg: 'rgb(var(--fg-rgb) / <alpha-value>)',
        ember: {
          DEFAULT: '#FF4515',
          deep: '#C62800',
          glow: '#FF6A2A',
        },
        // Scoped desk/KYC tokens (only resolve inside [data-surface]).
        surface: {
          DEFAULT: 'rgb(var(--s-surface) / <alpha-value>)',
          page: 'rgb(var(--s-bg) / <alpha-value>)',
          sunken: 'rgb(var(--s-bg-sunken) / <alpha-value>)',
          raised: 'rgb(var(--s-surface-raised) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'var(--s-line)',
          strong: 'var(--s-line-strong)',
        },
        control: 'rgb(var(--s-control) / <alpha-value>)',
        content: {
          DEFAULT: 'rgb(var(--s-text-1) / <alpha-value>)',
          muted: 'rgb(var(--s-text-2) / <alpha-value>)',
          subtle: 'rgb(var(--s-text-3) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--s-accent) / <alpha-value>)',
          ink: 'rgb(var(--s-accent-ink) / <alpha-value>)',
          on: 'rgb(var(--s-on-accent) / <alpha-value>)',
        },
        risk: {
          allow: 'rgb(var(--s-allow) / <alpha-value>)',
          review: 'rgb(var(--s-review) / <alpha-value>)',
          block: 'rgb(var(--s-block) / <alpha-value>)',
          pending: 'rgb(var(--s-pending) / <alpha-value>)',
        },
      },
      fontFamily: {
        display: ['"Roboto Condensed"', 'Roboto', 'system-ui', 'sans-serif'],
        sans: ['Roboto', 'system-ui', 'sans-serif'],
        ui: ['Manrope', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
      },
      boxShadow: {
        ember: '0 0 40px rgba(255, 69, 21, 0.45)',
        glass: '0 8px 32px rgba(0, 0, 0, 0.45)',
        surface: 'var(--s-shadow)',
      },
      backgroundImage: {
        'ember-grad': 'linear-gradient(135deg, #FF6A2A 0%, #FF4515 55%, #A01600 100%)',
        'hero-glow':
          'radial-gradient(ellipse 60% 80% at 72% 45%, rgba(255, 69, 21, 0.55) 0%, rgba(255, 69, 21, 0.18) 35%, transparent 70%)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        spinSlow: {
          to: { transform: 'rotate(360deg)' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        float: 'float 5s ease-in-out infinite',
        'float-delayed': 'float 5s ease-in-out 1.2s infinite',
        'spin-slow': 'spinSlow 28s linear infinite',
        'fade-up': 'fadeUp 0.8s ease-out both',
      },
    },
  },
  plugins: [],
}
