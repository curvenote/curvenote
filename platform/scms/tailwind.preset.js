import defaultTheme from 'tailwindcss/defaultTheme';
import tailwindFormsPlugin from '@tailwindcss/forms';
import headlessUIPlugin from '@headlessui/tailwindcss';
import tailwindTypographyPlugin from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  plugins: [tailwindFormsPlugin, headlessUIPlugin({ prefix: 'ui' }), tailwindTypographyPlugin],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      typography: {
        // modify typography here
      },
      colors: {
        'curvenote-blue': '#235f9c',
        'theme-blue-900': '#0D3D78',
        'theme-blue-800': '#184D8A',
        'theme-blue-700': '#215f9b', // Base color
        'theme-blue-500': '#4A7EB7',
        'theme-blue-300': '#6E9FD3',
        'theme-blue-100': '#92BFEA',
        'theme-blue-50': '#F0F8FE',
        'blue-950': '#060E17',
        'blue-900': '#0D1C2E',
        'blue-800': '#133C5A',
        'blue-700': '#1B5B83',
        'blue-600': '#227CAD',
        'blue-500': '#2B9CD8',
        'blue-400': '#56B0E1',
        'blue-300': '#7FC4E8',
        'blue-200': '#ABD7EF',
        'blue-100': '#D4EBF8',
        'blue-50': '#EAF5FA',
        'teal-900': '#006766',
        'teal-800': '#008284',
        'teal-700': '#0098A0',
        'teal-500': '#33B0B9',
        'teal-300': '#66C9D1',
        'teal-100': '#99E1E9',
        'teal-50': '#CCF4F7',
      },
      animation: {
        'gradient-1': 'animate-gradient-1 8s infinite',
        'gradient-2': 'animate-gradient-2 8s infinite',
        'gradient-3': 'animate-gradient-3 8s infinite',
        slideUpAndFade: 'slideUpAndFade 300ms cubic-bezier(0.16, 0, 0.13, 1)',
        slideDownAndFade: 'slideDownAndFade 300ms cubic-bezier(0.16, 0, 0.13, 1)',
        slideRightAndFade: 'slideRightAndFade 300ms cubic-bezier(0.16, 0, 0.13, 1)',
        slideLeftAndFade: 'slideLeftAndFade 300ms cubic-bezier(0.16, 0, 0.13, 1)',
      },
      keyframes: {
        'animate-gradient-1': {
          '0%, 16.667%, 100%': { opacity: '1' },
          '33.333%, 83.333%': { opacity: '0' },
        },
        'animate-gradient-2': {
          '0%, 16.667%, 66.667%, 100%': { opacity: '0' },
          '33.333%, 50%': { opacity: '1' },
        },
        'animate-gradient-3': {
          '0%, 50%,  100%': { opacity: '0' },
          '66.667%, 83.333%': { opacity: '1' },
        },
        slideUpAndFade: {
          '0%': { opacity: '0', transform: 'translateY(2px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideRightAndFade: {
          '0%': { opacity: '0', transform: 'translateX(-2px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideDownAndFade: {
          '0%': { opacity: '0', transform: 'translateY(-2px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideLeftAndFade: {
          '0%': { opacity: '0', transform: 'translateX(2px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      boxShadow: {
        'dark-visible':
          '0 4px 6px -1px rgba(255, 255, 255, 0.1), 0 2px 4px -2px rgba(255, 255, 255, 0.1)',
      },
    },
  },
};
