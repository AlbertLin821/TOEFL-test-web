/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        exam: {
          bar: '#005858',
          accent: '#005858',
          muted: '#94a3b8',
          subheader: '#f0f0f0',
        },
      },
    },
  },
  plugins: [],
};
