/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./index.tsx",
    "./AppRoot.tsx",
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./context/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Playfair Display"', "serif"],
        sans: ['"Lato"', "sans-serif"],
      },
      colors: {
        gold: {
          50: "#fbf9f1",
          100: "#f5f0db",
          200: "#ebdeaf",
          300: "#dec47d",
          400: "#d0a64b",
          500: "#b88a33",
          600: "#9b6b27",
          700: "#7d5122",
          800: "#684222",
          900: "#563720",
        },
        charcoal: "#1a1a1a",
      },
    },
  },
  plugins: [],
};
