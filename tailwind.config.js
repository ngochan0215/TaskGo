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

        // 2. MÀU MỚI TỪ TEMPLATE GỐC (Bắt buộc có để ra màu Tím)
        primaryTasker: {
          100: "#E0E7FF", // Tím nhạt
          200: "#A5B4FC", // Header tím
          400: "#4F46E5",
          500: "#3730A3", // Button/Text tím đậm
        },

        // 3. CÁC MÀU KHÁC
        secondary: { 100: "#12A327", 200: "#54A312" },
        accent: { 500: "#FFBE18" },
        danger: { 600: "#dc2626" },
        gray: {
          50: "#F9FAFB", 100: "#F3F4F6", 200: "#E5E7EB",
          300: "#D1D5DB", 400: "#9CA3AF", 500: "#6B7280",
          600: "#4B5563", 900: "#111827",
        },
        dark: { 900: "#111827" },
        white: "#FFFFFF", black: "#000000",
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};