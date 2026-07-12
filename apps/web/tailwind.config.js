/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        exam: {
          bar: '#1e3a5f',
          accent: '#2563eb',
          muted: '#94a3b8',
        },
      },
    },
  },
  plugins: [],
};
