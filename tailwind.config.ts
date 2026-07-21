import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0f1e42',
          deep: '#0a1530',
          2: '#16284f',
          700: '#1b2f5e',
        },
        ink: '#0c1730',
        red: {
          DEFAULT: '#d8202b',
          700: '#b5121d',
        },
        slate: {
          DEFAULT: '#48566f',
          2: '#64748b',
        },
        mist: {
          DEFAULT: '#f4f6fa',
          2: '#eef1f7',
        },
        line: '#e2e7f0',
      },
      fontFamily: {
        display: ['Archivo', 'system-ui', 'sans-serif'],
        body: ['Manrope', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '14px',
      },
    },
  },
  plugins: [],
};

export default config;
