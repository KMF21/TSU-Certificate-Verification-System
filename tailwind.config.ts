import type { Config } from 'tailwindcss'

// TSU brand tokens, shared with the main website (tsuniversity.edu.ng):
// deep navy for authority, crimson for calls to action.
// Status colours are separate from brand colours so a result is never
// read from the brand palette alone; each status also carries an icon and a word.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0F1F3D',
          50: '#EEF1F6',
          100: '#DCE2EC',
          600: '#1B3360',
          700: '#13284A',
          900: '#0A1730',
        },
        crimson: {
          DEFAULT: '#C4293B',
          50: '#FDF1F2',
          100: '#FADDE0',
          600: '#A81F30',
          700: '#8C1827',
        },
        canvas: '#F3F5F9',
        ink: {
          DEFAULT: '#1C2536',
          muted: '#5B6478',
          faint: '#8A93A6',
        },
        line: '#E3E7EF',
        status: {
          valid: '#0E7A4B',
          'valid-bg': '#E8F6EF',
          revoked: '#B42318',
          'revoked-bg': '#FEF0EE',
          superseded: '#B54708',
          'superseded-bg': '#FEF6E7',
          unknown: '#475467',
          'unknown-bg': '#F2F4F7',
        },
      },
      fontFamily: {
        display: ['var(--font-sora)', 'system-ui', 'sans-serif'],
        body: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '14px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,31,61,0.04), 0 8px 24px -12px rgba(15,31,61,0.12)',
        lift: '0 2px 4px rgba(15,31,61,0.06), 0 24px 48px -20px rgba(15,31,61,0.28)',
      },
      maxWidth: {
        shell: '1200px',
      },
    },
  },
  plugins: [],
}

export default config
