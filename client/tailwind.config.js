/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyberdark: '#0a0b0e',
        cybercard: '#12141c',
        cyberneon: '#00ffcc',
        cyberred: '#ff0055',
      }
    },
  },
  plugins: [],
}