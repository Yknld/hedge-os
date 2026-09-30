import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0a0c0f",
        surface: "#101318",
        raised: "#15191f",
        line: "#252b33",
        muted: "#8b95a3",
        positive: "#2dd4a3",
        negative: "#fb7185",
        accent: "#60a5fa"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["SFMono-Regular", "Cascadia Code", "Roboto Mono", "monospace"]
      }
    }
  },
  plugins: []
} satisfies Config;
