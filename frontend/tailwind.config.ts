import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#EEF4FF',
          100: '#D9E7FF',
          200: '#BBCFFE',
          300: '#8FB1FD',
          400: '#608AF9',
          500: '#3D64F4',
          600: '#1B43E8',
          700: '#1733CF',
          800: '#192BA7',
          900: '#1A2A84',
          950: '#E8EDFF',
        },
        surface: {
          DEFAULT: '#F0F4F8',
          sidebar: '#FFFFFF',
          card:    '#FFFFFF',
          hover:   '#F1F5F9',
          border:  '#DDE3EC',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        glass:      '0 4px 24px rgba(0,0,0,0.10)',
        card:       '0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover':'0 4px 16px rgba(0,0,0,0.12)',
        'tool-tt':  '0 8px 24px rgba(15,23,42,0.18)',
      },
      animation: {
        'fade-in':       'fadeIn 0.15s ease-in-out',
        'slide-up':      'slideUp 0.25s ease-out',
        'slide-in-right':'slideInRight 0.25s ease-out',
        shimmer:         'shimmer 2s linear infinite',
        'pulse-slow':    'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        fadeIn:       { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp:      { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideInRight: { from: { opacity: '0', transform: 'translateX(16px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        shimmer:      { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
};

export default config;
