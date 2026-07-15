/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#070A00',
        panel: '#11140A',
        mute: '#9A9A9A',
        light: '#FFFFFF',
        ember: {
          DEFAULT: '#FF4515',
          deep: '#C62800',
          glow: '#FF6A2A',
        },
      },
      fontFamily: {
        display: ['"Roboto Condensed"', 'Roboto', 'system-ui', 'sans-serif'],
        sans: ['Roboto', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        ember: '0 0 40px rgba(255, 69, 21, 0.45)',
        glass: '0 8px 32px rgba(0, 0, 0, 0.45)',
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
