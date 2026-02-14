/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontSize: {
        /* Heading sizes: +20% from base, rounded to 8px grid */
        'heading-1': ['96px', { lineHeight: '1.1' }],
        'heading-2': ['40px', { lineHeight: '1.2' }],
        'heading-3': ['32px', { lineHeight: '1.25' }],
        'heading-4': ['24px', { lineHeight: '1.3' }],
        'heading-5': ['16px', { lineHeight: '1.4' }],
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        /* H1/H2 v rich textu – IvyPresto Text z Adobe Fonts. Font-family ověřte v kit CSS na fonts.adobe.com */
        headline: ['ivypresto-text', 'Georgia', 'serif'],
        body: ['Inter', 'sans-serif'],
      },
      colors: {
        nokturo: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: 'rgba(229, 229, 229, 1)',
          300: '#d4d4d4',
          350: '#b8b8b8',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
        mention: '#D400FF',
      },
    },
  },
  plugins: [],
};
