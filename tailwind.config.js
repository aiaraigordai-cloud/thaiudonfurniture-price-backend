/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#F7F0E6',
        ivory: '#FFFAF3',
        espresso: '#402E20',
        taupe: '#705E4F',
        gold: {
          border: '#D2B681',
          accent: '#BB9251',
          luxury: '#C5A059',
          dark: '#805216',
          light: '#Fbf6ee',
        },
        line: '#06C755',
        promo: '#FF1E27',
        red: {
          brand: '#DE1B23',
          crimson: '#E31E24',
          dark: '#B91218',
          hover: '#C4161D',
          light: '#FFF1F2',
        },
        navy: {
          brand: '#161B40',
          dark: '#0C0F26',
          light: '#F0F4FA',
          850: '#151d2f',
          900: '#0F172A',
          950: '#020617',
        },
      },
      fontFamily: {
        sans: ['Prompt', 'Anuphan', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
