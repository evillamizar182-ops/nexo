/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:  ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Syne', 'system-ui', 'sans-serif'],
      },
      colors: {
        // ── Brand ───────────────────────────
        brand: {
          primary:   'var(--brand-primary)',
          secondary: 'var(--brand-secondary)',
          tertiary:  'var(--brand-tertiary)',
          success:   'var(--brand-success)',
          danger:    'var(--brand-danger)',
          warning:   'var(--brand-warning)',
          soft:      'var(--gradient-brand-soft)',
        },
        // ── Backgrounds ─────────────────────
        bg: {
          base:     'var(--bg-base)',
          surface:  'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
          dark:     'var(--bg-dark)',
          dark2:    'var(--bg-dark-2)',
          primary:  'var(--bg-base)',
          secondary:'var(--bg-surface)',
          card:     'var(--bg-elevated)',
        },
        // ── Text ────────────────────────────
        text: {
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary:  'var(--text-tertiary)',
          inverse:   'var(--text-inverse)',
        },
        // ── Borders ─────────────────────────
        border: {
          DEFAULT: 'var(--border-default)',
          subtle:  'var(--border-subtle)',
          strong:  'var(--border-strong)',
        },
        // ── Semantic aliases ─────────────────
        accent: {
          primary:   'var(--brand-primary)',
          secondary: 'var(--brand-secondary)',
          tertiary:  'var(--brand-tertiary)',
        },
        semantic: {
          success: 'var(--brand-success)',
          danger:  'var(--brand-danger)',
          warning: 'var(--brand-warning)',
        },
      },
      boxShadow: {
        'xs':          'var(--shadow-xs)',
        'sm':          'var(--shadow-sm)',
        'md':          'var(--shadow-md)',
        'lg':          'var(--shadow-lg)',
        'brand':       'var(--shadow-brand)',
        'brand-lg':    'var(--shadow-brand-lg)',
        'success':     'var(--shadow-success)',
        'danger':      'var(--shadow-danger)',
        'inset':       'var(--shadow-inset)',
        // Legacy aliases
        'soft':        'var(--shadow-sm)',
        'hover':       'var(--shadow-brand)',
        'card':        'var(--shadow-md)',
        'glow':        'var(--shadow-brand)',
      },
      borderRadius: {
        'sm':    'var(--radius-sm)',
        'md':    'var(--radius-md)',
        'lg':    'var(--radius-lg)',
        'xl':    'var(--radius-xl)',
        'full':  'var(--radius-full)',
        // Legacy aliases
        'card':  'var(--radius-lg)',
        'btn':   'var(--radius-md)',
        'input': 'var(--radius-md)',
        'badge': 'var(--radius-full)',
      },
      spacing: {
        '1':  'var(--space-1)',
        '2':  'var(--space-2)',
        '3':  'var(--space-3)',
        '4':  'var(--space-4)',
        '5':  'var(--space-5)',
        '6':  'var(--space-6)',
        '8':  'var(--space-8)',
        '10': 'var(--space-10)',
        '12': 'var(--space-12)',
      },
    },
  },
  plugins: [],
}
