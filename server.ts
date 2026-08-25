import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  getLicenseStatusHandler,
  activateLicenseHandler,
  adminCreateLicenseHandler,
  adminListLicensesHandler,
  adminUpdateLicenseHandler,
} from './backend/license/licenseController';
import {
  getPublicGalleryHandler,
  syncPublicGalleryHandler,
  getClientSelectionHandler,
  saveClientSelectionHandler,
} from './backend/gallery/galleryController';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body Parser
  app.use(express.json());

  // CORS Middleware for GitHub Pages / External access
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-key');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Health / Root Info
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'GaleriFotoQR Cloud Studio License Validation API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // License Validation API Endpoints
  app.post('/api/license/status', getLicenseStatusHandler);
  app.post('/api/license/activate', activateLicenseHandler);
  app.post('/api/license/validate', getLicenseStatusHandler);

  // Developer Admin Endpoints
  app.post('/api/license/admin/create', adminCreateLicenseHandler);
  app.get('/api/license/admin/list', adminListLicensesHandler);
  app.post('/api/license/admin/update-status', adminUpdateLicenseHandler);

  // Public Gallery & Client Selections Endpoints
  app.get('/api/gallery/:galleryId', getPublicGalleryHandler);
  app.post('/api/gallery/sync', syncPublicGalleryHandler);
  app.get('/api/gallery/selection/:galleryId', getClientSelectionHandler);
  app.post('/api/gallery/selection', saveClientSelectionHandler);

  // Vite middleware for development vs static dist for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] GaleriFotoQR Cloud Studio listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
