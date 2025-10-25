import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        midnight: '#04060B',
        'neon-sky': '#38bdf8',
        'neon-royal': '#1d4ed8',
        'neon-violet': '#8b5cf6',
      },
      dropShadow: {
        glow: '0 0 20px rgba(56, 189, 248, 0.55)',
        aurora: '0 0 38px rgba(139, 92, 246, 0.45)',
      },
      animation: {
        'slow-bounce': 'slow-bounce 2.8s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
      keyframes: {
        'slow-bounce': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.65' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
