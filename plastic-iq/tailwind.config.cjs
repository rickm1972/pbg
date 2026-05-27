/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './index.quiz.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
      },
      colors: {
        forest: {
          DEFAULT: '#0f3d26',
          deep: '#083320',
          muted: '#1a5c40',
        },
        ink: {
          900: '#0B1220',
          700: '#14213D',
          500: '#23395D',
        },
        paper: '#FFFFFF',
        excellent: '#047857',
        good: '#2563EB',
        caution: '#CA8A04',
        concern: '#EA580C',
        highrisk: '#DC2626',
      },
      boxShadow: {
        card: '0 1px 2px rgba(2,6,23,0.06), 0 6px 20px rgba(2,6,23,0.06)',
      },
      borderRadius: {
        xl2: '1rem',
      },
    },
  },
  plugins: [],
}

