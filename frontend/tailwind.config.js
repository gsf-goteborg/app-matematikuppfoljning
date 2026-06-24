/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Göteborgs Stad official palette (källa: grafisk profil).
        gbg: {
          blue: "#005293",
          "blue-dark": "#00395f",
          "blue-light": "#82bbdb",
          green: "#6a9a1f",
          "green-dark": "#4f6f18",
          "green-light": "#9ec038",
          purple: "#7f3f98",
          "purple-dark": "#5d287d",
          "purple-light": "#c39bd3",
          orange: "#f47815",
          "orange-dark": "#cf5e00",
          "orange-light": "#f9b000",
          red: "#e8364a",
          "red-dark": "#e1005e",
          "red-light": "#f391b1",
          yellow: "#fbc46d",
          "yellow-dark": "#f9a965",
          "yellow-light": "#fee7b8",
        },
        // Warm paper neutrals carry the structure; brand colours carry identity.
        paper: {
          DEFAULT: "#f6f4ee",
          card: "#fffefb",
          line: "#e4e0d4",
        },
        ink: {
          DEFAULT: "#1c2733",
          soft: "#5a6573",
          faint: "#8a93a0",
        },
        // Semantic risk scale mapped onto the official palette (green→red).
        risk: {
          0: "#6a9a1f", // gbg-green   – ingen risk
          1: "#f9b000", // gbg-orange-light – bevaka
          2: "#f47815", // gbg-orange  – förhöjd
          3: "#e8364a", // gbg-red     – kritisk
        },
      },
      fontFamily: {
        display: ['"Fraunces"', "Georgia", "serif"],
        sans: ['"Hanken Grotesk"', "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      boxShadow: {
        card: "0 1px 2px rgba(28,39,51,0.04), 0 8px 24px -16px rgba(28,39,51,0.18)",
        lift: "0 2px 4px rgba(28,39,51,0.06), 0 18px 40px -22px rgba(0,57,95,0.35)",
      },
      keyframes: {
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "sweep-in": {
          "0%": { opacity: "0", transform: "translateX(-8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "rise-in": "rise-in 0.5s cubic-bezier(0.22,1,0.36,1) both",
        "sweep-in": "sweep-in 0.4s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};
