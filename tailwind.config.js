/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Cinzel Decorative"', '"Cormorant Garamond"', "serif"],
        serif: ['"Cormorant Garamond"', "Georgia", "serif"],
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      colors: {
        lunar: {
          bg: "#060814",
          surface: "#0D1326",
          silver: "#CBD5E1",
          cobalt: "#1E3A8A",
          cyan: "#67E8F9",
          violet: "#A78BFA",
        },
        solar: {
          bg: "#110D0A",
          surface: "#1C1510",
          gold: "#D4AF37",
          bronze: "#B45309",
          amber: "#F59E0B",
        },
      },
    },
  },
  plugins: [],
};
