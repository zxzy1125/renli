/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
    },
    extend: {
      colors: {
        // 深墨绿主色（专业商务）
        forest: {
          50: "#f0f7f4",
          100: "#dcebe4",
          200: "#bbd7c9",
          300: "#8fbaa6",
          400: "#5e987f",
          500: "#3f7c63",
          600: "#2e6350",
          700: "#265042",
          800: "#1f4035",
          900: "#15302a",
          950: "#0a1d19",
        },
        // 暖米白背景
        cream: {
          50: "#fdfbf7",
          100: "#faf6ec",
          200: "#f4ecd4",
          300: "#ecdda9",
        },
        // 赭石橙强调色
        ochre: {
          50: "#fdf6ed",
          100: "#fae9d0",
          200: "#f4d0a0",
          300: "#ecb164",
          400: "#e69238",
          500: "#d9761b",
          600: "#bc5d14",
          700: "#974415",
          800: "#7c3717",
          900: "#662f16",
        },
        // AI 按钮专用琥珀色渐变
        ai: {
          from: "#f59e0b",
          to: "#d97706",
        },
        // 风险红色
        risk: {
          50: "#fef2f2",
          100: "#fee2e2",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
        },
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', "sans-serif"],
        serif: ['"Noto Serif SC"', '"Source Han Serif SC"', "serif"],
        mono: ['"JetBrains Mono"', "Consolas", "monospace"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px 0 rgb(0 0 0 / 0.04)",
        cardHover: "0 4px 12px 0 rgb(0 0 0 / 0.08), 0 2px 4px 0 rgb(0 0 0 / 0.04)",
      },
    },
  },
  plugins: [],
};
