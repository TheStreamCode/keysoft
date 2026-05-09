/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: update the paths for files that use className
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          400: '#478feb',
          500: '#1a73e8',
          600: '#155cba',
        },
        typography: {
          50: '#ffffff',
        },
      },
      borderRadius: {
        '2xl': 16,
      },
    },
  },
  plugins: [],
};
