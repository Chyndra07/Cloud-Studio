import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

/**
 * GitHub Pages SPA Route Recovery
 *
 * public/404.html menyimpan URL asli ke:
 * sessionStorage['github-pages-route']
 *
 * Contoh:
 * /Cloud-Studio/gallery/GFQ-79YF92
 *
 * GitHub Pages kemudian membuka:
 * /Cloud-Studio/
 *
 * Sebelum React dijalankan, route asli dikembalikan
 * agar App.tsx dapat membaca gallery ID.
 */
const restoreGitHubPagesRoute = () => {
  try {
    const savedRoute = sessionStorage.getItem('github-pages-route');

    if (!savedRoute) return;

    // Hapus segera agar tidak menyebabkan redirect loop.
    sessionStorage.removeItem('github-pages-route');

    const basePath = '/Cloud-Studio';

    let route = savedRoute.trim();

    // Pastikan route diawali "/"
    if (!route.startsWith('/')) {
      route = '/' + route;
    }

    // 404.html menyimpan route relatif seperti:
    // /gallery/GFQ-79YF92
    //
    // Kita kembalikan menjadi:
    // /Cloud-Studio/gallery/GFQ-79YF92
    const restoredUrl =
      route.startsWith(basePath + '/')
        ? route
        : basePath + route;

    window.history.replaceState(
      null,
      '',
      restoredUrl
    );

    console.log(
      '[GitHub Pages SPA] Route restored:',
      restoredUrl
    );
  } catch (error) {
    console.warn(
      '[GitHub Pages SPA] Failed to restore route:',
      error
    );
  }
};

// WAJIB dijalankan sebelum <App /> dirender.
restoreGitHubPagesRoute();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
