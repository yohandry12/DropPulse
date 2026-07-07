/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Flat-design slate + stock-green accent (design-system tokens)
        primary: "#334155",
        secondary: "#475569",
        accent: "#059669",
        background: "#F8FAFC",
        foreground: "#0F172A",
        muted: "#F2F3F4",
        border: "#E6E8EA",
        destructive: "#DC2626",
      },
      fontFamily: {
        sans: ['"Nunito Sans"', "system-ui", "sans-serif"],
        heading: ["Rubik", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
