import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Auto-update Service Worker whenever a new version is published
const updateSW = registerSW({
  onNeedRefresh() {
    // When a new version is detected in background, update and reload immediately
    updateSW(true);
  },
  onRegistered(r) {
    // Check for updates every 60 seconds or on window focus
    if (r) {
      setInterval(() => {
        r.update();
      }, 60 * 1000);
      window.addEventListener('focus', () => {
        r.update();
      });
    }
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
