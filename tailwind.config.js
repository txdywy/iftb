/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pitch: {
          950: '#07100d',
          900: '#0a1714',
          850: '#0e201b',
          800: '#122720'
        },
        line: '#6bf2b8',
        cyanline: '#52d9ff',
        warning: '#ffcf5c',
        danger: '#ff6b81'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      boxShadow: {
        glow: '0 0 32px rgba(107, 242, 184, 0.14)'
      }
    }
  },
  plugins: []
};
