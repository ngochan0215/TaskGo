/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./templates/**/*.html", "./*.html"],
  theme: {
    extend: {
      fontFamily: {
        montserrat: ["Montserrat", "sans-serif"], // Tuỳ chỉnh font 'montserrat'
      },
      colors: {
        primary: {
          100: "#EAFED9", // cream
          200: "#95DA97", // light green
          400: "#5C956C", // medium green
          500: "#3B5F43", // dark green
        },
        secondary: {
          100: "#12A327",
          200: "#54A312",
        },
        accent: {
          500: "#FFBE18", //warning yellow
        },
        gray: {
          100: "#60655C",
          400: "#969496",
        },
        dark: {
          900: "#282A37",
        },
        white: "#FFFFFF",
        black: "#000000",
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
