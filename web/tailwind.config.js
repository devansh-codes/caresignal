/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        'surface-2': v('surface-2'),
        border: v('border'),
        ink: v('ink'),
        muted: v('muted'),
        primary: v('primary'),
        'primary-ink': v('primary-ink'),
        critical: v('critical'),
        warning: v('warning'),
        ok: v('ok'),
        nursing: v('cat-nursing'),
        shared: v('cat-shared'),
        other: v('cat-other'),
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: { card: '10px' },
    },
  },
  plugins: [],
}
