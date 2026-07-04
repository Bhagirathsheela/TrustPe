import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        trustpe: {
          ink: '#0F172A',
          paper: '#F8FAFC',
          accent: '#2563EB',
        },
      },
    },
  },
  plugins: [],
};

export default config;
