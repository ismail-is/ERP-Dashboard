/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#ffffff",
        foreground: "#000000",
        muted: "#f4f4f5",
        "muted-foreground": "#71717a",
        accent: "#f4f4f5",
        "accent-foreground": "#18181b",
        border: "#e4e4e7",
      },
      borderRadius: {
        '2xl': '1rem',
      }
    },
  },
  plugins: [],
}
