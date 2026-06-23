/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        risk: {
          0: "#16a34a", // green
          1: "#eab308", // yellow
          2: "#f97316", // orange
          3: "#dc2626", // red
        },
      },
    },
  },
  plugins: [],
};
