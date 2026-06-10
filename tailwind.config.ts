import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

export default {
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        body: [
          'Inter',
          'Alibaba PuHuiTi 3.0',
          'Alibaba PuHuiTi',
          'PingFang SC',
          'Microsoft YaHei',
          '-apple-system',
          'BlinkMacSystemFont',
          'ui-sans-serif',
          'system-ui',
          'sans-serif'
        ]
      },
      colors: {
        surface: '#f8fafc',
        'text-main': '#1c1c1e',
        muted: '#8a94a6'
      },
      boxShadow: {
        panel: '0 14px 35px rgba(15, 23, 42, 0.08)',
        input: '0 12px 30px rgba(15, 23, 42, 0.12)'
      }
    }
  },
  plugins: [animate]
} satisfies Config;
