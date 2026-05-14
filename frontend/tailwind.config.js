/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {colors: {
        socio: {
          DEFAULT: '#6C47FF',
          light: '#F1EFFF',
          dark: '#4B29D9',
        },
      },} },
  plugins: [],
};
