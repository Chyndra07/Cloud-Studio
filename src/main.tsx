import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

/**
 * GitHub Pages SPA Route Recovery
 *
 * public/404.html menyimpan route asli ke sessionStorage
 * sebelum mengarahkan browser kembali ke /Cloud-Studio/.
 *
 * Di sini route tersebut dikembalikan sebelum React dirender.
 */
const restoreGitHubPagesRoute = () => {
  try {
    const savedRoute = sessionStorage.getItem('github-pages-route');

    if (!savedRoute) return;

    sessionStorage.removeItem('github-pages-route');

    const basePath = '/Cloud-Studio';

    let cleanRoute = savedRoute.trim();

    if (!cleanRoute.startsWith('/')) {
      cleanRoute = '/' + cleanRoute;
    }

    const targetUrl = basePath + cleanRoute;

    window.history.replaceState(
      null,
      '',
      targetUrl
    );
  } catch (error) {
    console.warn(
      '[GitHub Pages] Failed to restore gallery route:',
      error
    );
  }
};

restoreGitHubPagesRoute();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
