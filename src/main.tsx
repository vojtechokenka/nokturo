import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './components/ThemeProvider';
import { polyfillCountryFlagEmojis } from 'country-flag-emoji-polyfill';

// Initialize i18n (must run before React renders)
import './i18n';

// Global styles
import './index.css';

// Fix flag emoji on Windows (Chrome/Edge show "CZ" instead of 🇨🇿)
polyfillCountryFlagEmojis();

// Prevent unhandled promise rejections from crashing the app (e.g. after inactivity)
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Nokturo] Unhandled rejection:', event.reason);
  event.preventDefault();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
