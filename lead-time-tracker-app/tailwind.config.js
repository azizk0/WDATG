/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'Courier Prime'", "ui-monospace", "monospace"],
        stamp: ["'Special Elite'", "'Courier Prime'", "monospace"],
      },
    },
  },
  plugins: [],
};
