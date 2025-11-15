/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./templates/**/*.{html,htm}",
  ],
  theme: {
    extend: {
      fontFamily: {
        montserrat: ['Montserrat', 'sans-serif'], // Tuỳ chỉnh font 'montserrat'
      },
      colors: {
        primary: {
          100: '#EAFED9', // cream
          200: '#95DA97', // light green
          400: '#5C956C', // medium green
          500: '#3B5F43', // dark green
        },
        accent: {
          500: '#FFBE18', //warning yellow
        },
        gray: {
          400: '#969496',
        },
        dark: {
          900: '#282A37', 
        },
        white: '#FFFFFF',
        black: '#000000',
      },
    },
  },
  plugins: [],
}
