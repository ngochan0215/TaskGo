/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./templates/**/*.html",
    "./components/**/*.html",
    "./src/**/*.js"
  ],
  theme: {
    extend: {
      fontFamily: {
        montserrat: ["Montserrat", "sans-serif"],
      },
      colors: {
        // 1. MÀU CŨ (Giữ nguyên)
        primary: {
          100: "#EAFED9",
          200: "#95DA97",
          400: "#5C956C",
          500: "#3B5F43",
        },
        primaryTasker: {
          100: "#E0E7FF",
          200: "#A5B4FC",
          400: "#4F46E5",
          500: "#3730A3",
        },
        secondary: {
          100: "#12A327",
          150: "#108121ff",
          200: "#54A312",
        },
        accent: {
          500: "#FFBE18", //warning yellow
          550: "#e0a714ff",
        },
        danger: {
          600: "#dc2626",
          650: "#bd1d1dff",
        },

        // gray: {
        //   100: "#60655C",
        //   400: "#969496",
        // },
        gray: {
          50: "#F7F7F7",
          100: "#E7E7E7",
          200: "#D1D5DB",
          300: "#9CA3AF",
          600: "#4B5563",
          700: "#374151",
          800: "#1F2937",
          900: "#111827",
        },
        dark: {
          900: "#282A37",
        },
        // blue: "#283891",
        white: "#FFFFFF",
        black: "#000000",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
