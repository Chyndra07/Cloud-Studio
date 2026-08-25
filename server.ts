import express from 'express';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// ================= CORS FOR GITHUB PAGES =================
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://chyndra07.github.io',
    'http://localhost:3000',
    'http://localhost:5173'
  ];

  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With'
  );

  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});
// ==========================================================

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ----------------- PERSISTENT DATA LAYER -----------------
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'public_galleries.json');
const PROFILES_FILE = path.join(DATA_DIR, 'studio_profiles.json');
const LOGOS_DIR = path.join(DATA_DIR, 'logos');

interface PublicPhotoItem {
  id: string;
  albumId?: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  driveFileId?: string;
  thumbnailUrl: string;
  previewUrl?: string;
  downloadUrl?: string;
  isDeleted?: boolean;
  uploadedAt: string;
}

interface PublicStudioInfo {
  studioName: string;
  tagline: string;
  logoUrl?: string;
  studioLogoUrl?: string;
  studioLogoPath?: string;
  whatsappNumber: string;
  instagram: string;
  website: string;
  address: string;
  accentColor: string;
  watermarkEnabled: boolean;
  watermarkText: string;
  watermarkPosition: 'bottom-right' | 'bottom-left' | 'center' | 'top-right';
  galleryFooterText: string;
  welcomeMessage: string;
  allowClientDownload: boolean;
  allowBatchZipDownload: boolean;
  customGalleryDomain?: string;
  updatedAt?: string;
}

interface PublicGalleryRecord {
  galleryId: string;
  ownerUid: string;
  ownerId: string;
  studioId: string;
  albumId: string;
  albumName: string;
  eventName: string;
  clientName: string;
  customerName: string;
  eventDate: string;
  description: string;
  coverPhotoUrl?: string;
  status: 'published' | 'disabled' | 'archived' | 'expired';
  isPublished: boolean;
  pinEnabled: boolean;
  isPasswordProtected: boolean;
  pinHash?: string;
  passwordHash?: string;
  displayQuality?: 'light' | 'hd';
  expiresAt?: string;
  expiryAction?: 'disable' | 'trash';
  isDeleted: boolean;
  viewsCount: number;
  downloadsCount: number;
  driveFolderId?: string;
  driveFolderUrl?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  photos: PublicPhotoItem[];
  studio: PublicStudioInfo;
}

// In-memory cache synced with disk file
let publicGalleriesMap: Record<string, PublicGalleryRecord> = {};
let studioProfilesMap: Record<string, PublicStudioInfo> = {};

function initPersistentStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(LOGOS_DIR)) {
      fs.mkdirSync(LOGOS_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const loaded = JSON.parse(content || '{}');
      const cleaned: Record<string, PublicGalleryRecord> = {};
      for (const [k, v] of Object.entries(loaded)) {
        const item = v as PublicGalleryRecord;
        if (
          !k.startsWith('GFQ-LUM-') && 
          !k.startsWith('GFQ-KNC-') && 
          item.ownerId !== 'studio_lumina_demo' && 
          item.ownerId !== 'studio_kencana_demo'
        ) {
          const normKey = k.trim().toUpperCase();
          cleaned[normKey] = item;
        }
      }
      publicGalleriesMap = cleaned;
      saveDatabaseToDisk();
      console.log(`[Database] Loaded ${Object.keys(publicGalleriesMap).length} persistent galleries from disk.`);
    } else {
      publicGalleriesMap = {};
      saveDatabaseToDisk();
      console.log(`[Database] Storage initialized with clean empty state.`);
    }

    if (fs.existsSync(PROFILES_FILE)) {
      const pContent = fs.readFileSync(PROFILES_FILE, 'utf-8');
      studioProfilesMap = JSON.parse(pContent || '{}');
      console.log(`[Database] Loaded ${Object.keys(studioProfilesMap).length} studio profiles from disk.`);
    } else {
      studioProfilesMap = {};
      saveProfilesToDisk();
    }
  } catch (err) {
    console.error('[Database] Failed to initialize persistent storage:', err);
    publicGalleriesMap = {};
    studioProfilesMap = {};
  }
}

function saveDatabaseToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(publicGalleriesMap, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Database] Failed to write database to disk:', err);
  }
}

function saveProfilesToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(studioProfilesMap, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Database] Failed to write profiles to disk:', err);
  }
}

function reloadDatabaseFromDisk() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const loaded = JSON.parse(content || '{}');
      for (const [k, v] of Object.entries(loaded)) {
        const normKey = k.trim().toUpperCase();
        publicGalleriesMap[normKey] = v as PublicGalleryRecord;
      }
    }
    if (fs.existsSync(PROFILES_FILE)) {
      const pContent = fs.readFileSync(PROFILES_FILE, 'utf-8');
      studioProfilesMap = JSON.parse(pContent || '{}');
    }
  } catch (err) {
    console.error('[Database] Failed to reload database:', err);
  }
}

initPersistentStorage();

// ----------------- PUBLIC GALLERY API ROUTES -----------------

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    totalGalleries: Object.keys(publicGalleriesMap).length,
    timestamp: new Date().toISOString(),
  });
});

// App Configuration & Production URL Provider
app.get('/api/config', (req, res) => {
  const hostHeader = req.get('host') || '';
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
  let detectedUrl = hostHeader && !hostHeader.includes('localhost') && !hostHeader.includes('127.0.0.1') ? `${proto}://${hostHeader}` : '';
  
  if (detectedUrl.includes('ais-dev-')) {
    detectedUrl = detectedUrl.replace('ais-dev-', 'ais-pre-');
  }

  let envAppUrl = process.env.APP_URL || '';
  if (envAppUrl.includes('ais-dev-')) {
    envAppUrl = envAppUrl.replace('ais-dev-', 'ais-pre-');
  }

  const PUBLIC_APP_ORIGIN = 'https://ais-pre-eroa24qfq6d4z76ps275od-153899979881.asia-southeast1.run.app';
  const appUrl = envAppUrl || detectedUrl || PUBLIC_APP_ORIGIN;

  res.json({
    appUrl,
    cloudRunUrl: appUrl,
    environment: process.env.NODE_ENV || 'development',
  });
});

// GET Public Gallery Lookup by Gallery ID or Slug
app.get('/api/public/gallery/:galleryId', (req, res) => {
  const rawId = req.params.galleryId;
  if (!rawId) {
    return res.status(400).json({ error: 'Gallery ID wajib disertakan.' });
  }

  const target = rawId.trim().toUpperCase();
  console.log(`[Public Gallery Lookup] Query: "${target}"`);

  // 1. Direct key match
  let matched: PublicGalleryRecord | undefined = publicGalleriesMap[target];

  // 2. Case-insensitive or Album ID match in memory
  if (!matched) {
    for (const key of Object.keys(publicGalleriesMap)) {
      const item = publicGalleriesMap[key];
      if (
        key.toUpperCase() === target ||
        (item.galleryId && item.galleryId.toUpperCase() === target) ||
        (item.albumId && item.albumId.toUpperCase() === target)
      ) {
        matched = item;
        break;
      }
    }
  }

  // 3. If still not found, try reloading latest disk file (in case another process wrote it)
  if (!matched) {
    reloadDatabaseFromDisk();
    matched = publicGalleriesMap[target];
    if (!matched) {
      for (const key of Object.keys(publicGalleriesMap)) {
        const item = publicGalleriesMap[key];
        if (
          key.toUpperCase() === target ||
          (item.galleryId && item.galleryId.toUpperCase() === target) ||
          (item.albumId && item.albumId.toUpperCase() === target)
        ) {
          matched = item;
          break;
        }
      }
    }
  }

  if (!matched) {
    console.log(`[Public Gallery Lookup] NOT FOUND: "${target}". Available keys:`, Object.keys(publicGalleriesMap));
    return res.status(404).json({
      status: 'not_found',
      message: 'Galeri foto tidak ditemukan. Pastikan tautan atau QR Code yang Anda gunakan sudah benar.',
      galleryId: target,
    });
  }

  // Check if deleted or disabled
  if (matched.isDeleted || matched.status === 'disabled' || matched.isPublished === false) {
    return res.status(410).json({
      status: 'disabled',
      message: 'Galeri foto ini sedang dinonaktifkan atau telah dihapus oleh studio.',
      galleryId: matched.galleryId,
    });
  }

  // Check if expired
  const isExpired = !!(matched.expiresAt && new Date(matched.expiresAt) < new Date());

  const responseBundle = {
    status: isExpired ? 'expired' : 'ok',
    galleryId: matched.galleryId,
    isPublished: true,
    album: {
      id: matched.albumId,
      galleryId: matched.galleryId,
      ownerId: matched.ownerId || matched.ownerUid,
      ownerUid: matched.ownerUid || matched.ownerId,
      customerName: matched.customerName || matched.clientName,
      clientName: matched.clientName || matched.customerName,
      eventName: matched.eventName || matched.albumName,
      albumName: matched.albumName || matched.eventName,
      eventDate: matched.eventDate,
      description: matched.description || '',
      coverPhotoUrl: matched.coverPhotoUrl,
      isPasswordProtected: !!(matched.isPasswordProtected || matched.pinEnabled),
      pinEnabled: !!(matched.pinEnabled || matched.isPasswordProtected),
      passwordHash: matched.passwordHash || matched.pinHash,
      pinHash: matched.pinHash || matched.passwordHash,
      displayQuality: matched.displayQuality || 'hd',
      expiresAt: matched.expiresAt,
      expiryAction: matched.expiryAction || 'disable',
      isDeleted: matched.isDeleted || false,
      isPublished: true,
      status: 'published',
      viewsCount: matched.viewsCount || 0,
      downloadsCount: matched.downloadsCount || 0,
      photosCount: matched.photos ? matched.photos.filter((p) => !p.isDeleted).length : 0,
      createdAt: matched.createdAt,
      updatedAt: matched.updatedAt,
      publishedAt: matched.publishedAt || matched.updatedAt || matched.createdAt,
    },
    photos: isExpired ? [] : (matched.photos || []).filter((p) => !p.isDeleted),
    studio: matched.studio,
  };

  return res.json(responseBundle);
});

// POST /api/public/gallery - Create or Update Public Gallery Record (Single Source of Truth)
app.post('/api/public/gallery', (req, res) => {
  try {
    const { album, photos, studio } = req.body;
    if (!album || !(album.galleryId || album.id)) {
      return res.status(400).json({ error: 'Data album dan galleryId tidak valid.' });
    }

    const rawGalleryId = album.galleryId || album.id;
    const galleryId = rawGalleryId.trim().toUpperCase();
    const existing: Partial<PublicGalleryRecord> = publicGalleriesMap[galleryId] || {};

    const albumName = album.albumName || album.eventName || existing.albumName || existing.eventName || 'Acara Foto';
    const clientName = album.clientName || album.customerName || existing.clientName || existing.customerName || 'Pelanggan';
    const ownerId = album.ownerUid || album.ownerId || existing.ownerUid || existing.ownerId || 'studio_owner';
    const pin = album.pinHash || album.passwordHash || existing.pinHash || existing.passwordHash;
    const pinEnabled = album.pinEnabled !== undefined ? Boolean(album.pinEnabled) : (album.isPasswordProtected !== undefined ? Boolean(album.isPasswordProtected) : Boolean(pin));

    const record: PublicGalleryRecord = {
      galleryId: galleryId,
      ownerUid: ownerId,
      ownerId: ownerId,
      studioId: ownerId,
      albumId: album.id || album.albumId || existing.albumId || `alb_${Date.now()}`,
      albumName: albumName,
      eventName: albumName,
      clientName: clientName,
      customerName: clientName,
      eventDate: album.eventDate || existing.eventDate || new Date().toISOString().split('T')[0],
      description: album.description || existing.description || '',
      coverPhotoUrl: album.coverPhotoUrl || existing.coverPhotoUrl,
      status: 'published',
      isPublished: true,
      pinEnabled: pinEnabled,
      isPasswordProtected: pinEnabled,
      pinHash: pin,
      passwordHash: pin,
      displayQuality: album.displayQuality || existing.displayQuality || 'hd',
      expiresAt: album.expiresAt !== undefined ? album.expiresAt : existing.expiresAt,
      expiryAction: album.expiryAction || existing.expiryAction || 'disable',
      isDeleted: album.isDeleted !== undefined ? Boolean(album.isDeleted) : (existing.isDeleted || false),
      viewsCount: album.viewsCount ?? existing.viewsCount ?? 0,
      downloadsCount: album.downloadsCount ?? existing.downloadsCount ?? 0,
      driveFolderId: album.driveFolderId || existing.driveFolderId,
      driveFolderUrl: album.driveFolderUrl || existing.driveFolderUrl,
      createdAt: album.createdAt || existing.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: album.publishedAt || existing.publishedAt || new Date().toISOString(),
      photos: Array.isArray(photos) ? photos : existing.photos || [],
      studio: (() => {
        const ownerProf = (studioProfilesMap[ownerId] || {}) as Partial<PublicStudioInfo>;
        const incomingStudio = (studio || existing.studio || {}) as Partial<PublicStudioInfo>;
        return {
          studioName: incomingStudio.studioName || ownerProf.studioName || 'Studio Foto',
          tagline: incomingStudio.tagline || ownerProf.tagline || 'Professional Photography',
          logoUrl: incomingStudio.logoUrl || incomingStudio.studioLogoUrl || ownerProf.logoUrl || ownerProf.studioLogoUrl,
          studioLogoUrl: incomingStudio.studioLogoUrl || incomingStudio.logoUrl || ownerProf.studioLogoUrl || ownerProf.logoUrl,
          studioLogoPath: incomingStudio.studioLogoPath || ownerProf.studioLogoPath,
          whatsappNumber: incomingStudio.whatsappNumber !== undefined ? incomingStudio.whatsappNumber : ownerProf.whatsappNumber || '',
          instagram: incomingStudio.instagram !== undefined ? incomingStudio.instagram : ownerProf.instagram || '',
          website: incomingStudio.website !== undefined ? incomingStudio.website : ownerProf.website || '',
          address: incomingStudio.address !== undefined ? incomingStudio.address : ownerProf.address || '',
          accentColor: incomingStudio.accentColor || ownerProf.accentColor || '#2563eb',
          watermarkEnabled: incomingStudio.watermarkEnabled !== undefined ? incomingStudio.watermarkEnabled : ownerProf.watermarkEnabled || false,
          watermarkText: incomingStudio.watermarkText !== undefined ? incomingStudio.watermarkText : ownerProf.watermarkText || '',
          watermarkPosition: incomingStudio.watermarkPosition || ownerProf.watermarkPosition || 'bottom-right',
          galleryFooterText: incomingStudio.galleryFooterText !== undefined ? incomingStudio.galleryFooterText : ownerProf.galleryFooterText || 'Terima kasih telah mempercayakan momen terbaik Anda bersama kami.',
          welcomeMessage: incomingStudio.welcomeMessage !== undefined ? incomingStudio.welcomeMessage : ownerProf.welcomeMessage || 'Selamat menikmati galeri foto kenangan Anda.',
          allowClientDownload: incomingStudio.allowClientDownload !== undefined ? incomingStudio.allowClientDownload : true,
          allowBatchZipDownload: incomingStudio.allowBatchZipDownload !== undefined ? incomingStudio.allowBatchZipDownload : true,
          customGalleryDomain: incomingStudio.customGalleryDomain || ownerProf.customGalleryDomain,
        };
      })(),
    };

    publicGalleriesMap[galleryId] = record;
    saveDatabaseToDisk();

    console.log(`[Public Gallery Saved & Published] ${galleryId} (${record.eventName} - ${record.customerName}) Photos: ${record.photos.length}`);
    return res.json({ success: true, galleryId, isPublished: true, record });
  } catch (err: any) {
    console.error('[Public Gallery Save Error]', err);
    return res.status(500).json({ error: 'Gagal menyimpan galeri publik.', details: err.message });
  }
});

// POST /api/public/gallery/:galleryId/photos - Upload / Add photos to public gallery
app.post('/api/public/gallery/:galleryId/photos', (req, res) => {
  const { galleryId } = req.params;
  const { newPhotos, coverPhotoUrl } = req.body;

  const matched = publicGalleriesMap[galleryId.trim()];
  if (!matched) {
    return res.status(404).json({ error: 'Galeri tidak ditemukan.' });
  }

  if (Array.isArray(newPhotos)) {
    const existingIds = new Set((matched.photos || []).map((p) => p.id));
    const toAdd = newPhotos.filter((p) => !existingIds.has(p.id));
    matched.photos = [...toAdd, ...(matched.photos || [])];
  }

  if (coverPhotoUrl) {
    matched.coverPhotoUrl = coverPhotoUrl;
  }
  matched.updatedAt = new Date().toISOString();

  saveDatabaseToDisk();
  return res.json({ success: true, totalPhotos: matched.photos.length });
});

// POST /api/public/gallery/:galleryId/view - Increment View Count
app.post('/api/public/gallery/:galleryId/view', (req, res) => {
  const { galleryId } = req.params;
  const target = galleryId.trim();

  let matched = publicGalleriesMap[target];
  if (!matched) {
    for (const k of Object.keys(publicGalleriesMap)) {
      if (k.toLowerCase() === target.toLowerCase()) {
        matched = publicGalleriesMap[k];
        break;
      }
    }
  }

  if (matched) {
    matched.viewsCount = (matched.viewsCount || 0) + 1;
    saveDatabaseToDisk();
  }
  return res.json({ success: true });
});

// POST /api/public/gallery/:galleryId/download - Increment Download Count
app.post('/api/public/gallery/:galleryId/download', (req, res) => {
  const { galleryId } = req.params;
  const target = galleryId.trim();

  let matched = publicGalleriesMap[target];
  if (!matched) {
    for (const k of Object.keys(publicGalleriesMap)) {
      if (k.toLowerCase() === target.toLowerCase()) {
        matched = publicGalleriesMap[k];
        break;
      }
    }
  }

  if (matched) {
    matched.downloadsCount = (matched.downloadsCount || 0) + 1;
    saveDatabaseToDisk();
  }
  return res.json({ success: true });
});

// POST /api/public/sync - Sync full tenant state from client
app.post('/api/public/sync', (req, res) => {
  try {
    const { bundles } = req.body;
    if (Array.isArray(bundles)) {
      for (const item of bundles) {
        if (item.album && (item.album.galleryId || item.album.id)) {
          const gId = (item.album.galleryId || item.album.id).trim().toUpperCase();
          const alb = item.album;
          const albumName = alb.albumName || alb.eventName || 'Acara Foto';
          const clientName = alb.clientName || alb.customerName || 'Pelanggan';
          const ownerId = alb.ownerUid || alb.ownerId || 'studio_owner';
          const pin = alb.pinHash || alb.passwordHash;
          const pinEnabled = alb.pinEnabled !== undefined ? Boolean(alb.pinEnabled) : (alb.isPasswordProtected !== undefined ? Boolean(alb.isPasswordProtected) : Boolean(pin));

          publicGalleriesMap[gId] = {
            galleryId: gId,
            ownerUid: ownerId,
            ownerId: ownerId,
            studioId: ownerId,
            albumId: alb.id || alb.albumId || `alb_${Date.now()}`,
            albumName: albumName,
            eventName: albumName,
            clientName: clientName,
            customerName: clientName,
            eventDate: alb.eventDate || new Date().toISOString().split('T')[0],
            description: alb.description || '',
            coverPhotoUrl: alb.coverPhotoUrl,
            status: alb.isDeleted ? 'disabled' : 'published',
            isPublished: !alb.isDeleted,
            pinEnabled: pinEnabled,
            isPasswordProtected: pinEnabled,
            pinHash: pin,
            passwordHash: pin,
            displayQuality: alb.displayQuality || 'hd',
            expiresAt: alb.expiresAt,
            expiryAction: alb.expiryAction || 'disable',
            isDeleted: !!alb.isDeleted,
            viewsCount: alb.viewsCount || 0,
            downloadsCount: alb.downloadsCount || 0,
            driveFolderId: alb.driveFolderId,
            driveFolderUrl: alb.driveFolderUrl,
            createdAt: alb.createdAt || new Date().toISOString(),
            updatedAt: alb.updatedAt || new Date().toISOString(),
            publishedAt: alb.publishedAt || alb.createdAt || new Date().toISOString(),
            photos: item.photos || [],
            studio: item.studio || publicGalleriesMap[gId]?.studio || {
              studioName: 'Studio Foto',
              tagline: 'Professional Photography',
              whatsappNumber: '',
              instagram: '',
              website: '',
              address: '',
              accentColor: '#2563eb',
              watermarkEnabled: false,
              watermarkText: '',
              watermarkPosition: 'bottom-right',
              galleryFooterText: 'Terima kasih telah mempercayakan momen terbaik Anda bersama kami.',
              welcomeMessage: 'Selamat menikmati galeri foto kenangan Anda.',
              allowClientDownload: true,
              allowBatchZipDownload: true,
            },
          };
        }
      }
      saveDatabaseToDisk();
    }
    return res.json({ success: true, count: Object.keys(publicGalleriesMap).length });
  } catch (err: any) {
    return res.status(500).json({ error: 'Gagal melakukan sinkronisasi server.', details: err.message });
  }
});

// DELETE /api/public/gallery/:galleryId - Permanently delete public gallery from server
app.delete('/api/public/gallery/:galleryId', (req, res) => {
  try {
    const { galleryId } = req.params;
    const { ownerId } = req.query;
    if (!galleryId) {
      return res.status(400).json({ error: 'Gallery ID wajib disertakan.' });
    }

    const target = galleryId.trim().toUpperCase();
    let deletedCount = 0;

    // Delete exact match
    if (publicGalleriesMap[target]) {
      const g = publicGalleriesMap[target];
      if (!ownerId || g.ownerId === ownerId || g.ownerUid === ownerId) {
        delete publicGalleriesMap[target];
        deletedCount++;
      }
    }

    // Also check other keys for matching galleryId or albumId
    for (const key of Object.keys(publicGalleriesMap)) {
      const item = publicGalleriesMap[key];
      if (
        (key.toUpperCase() === target ||
          (item.galleryId && item.galleryId.toUpperCase() === target) ||
          (item.albumId && item.albumId.toUpperCase() === target)) &&
        (!ownerId || item.ownerId === ownerId || item.ownerUid === ownerId)
      ) {
        delete publicGalleriesMap[key];
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      saveDatabaseToDisk();
    }

    console.log(`[Public Gallery Permanent Delete] Query: "${target}", Deleted: ${deletedCount}`);
    return res.json({ success: true, deletedCount });
  } catch (err: any) {
    console.error('[Public Gallery Permanent Delete Error]', err);
    return res.status(500).json({ error: 'Gagal menghapus galeri permanen dari server.', details: err.message });
  }
});

// POST /api/public/trash/empty - Permanently empty all trashed galleries for tenant
app.post('/api/public/trash/empty', (req, res) => {
  try {
    const { ownerId, galleryIds, albumIds } = req.body;
    if (!ownerId) {
      return res.status(400).json({ error: 'ownerId wajib disertakan.' });
    }

    const gIdSet = new Set((galleryIds || []).map((id: string) => id.trim().toUpperCase()));
    const albIdSet = new Set((albumIds || []).map((id: string) => id.trim()));

    let deletedCount = 0;
    for (const key of Object.keys(publicGalleriesMap)) {
      const item = publicGalleriesMap[key];
      const isOwner = item.ownerId === ownerId || item.ownerUid === ownerId;
      if (!isOwner) continue;

      const isMarked = 
        item.isDeleted || 
        gIdSet.has(key.toUpperCase()) || 
        (item.galleryId && gIdSet.has(item.galleryId.toUpperCase())) ||
        (item.albumId && albIdSet.has(item.albumId));

      if (isMarked) {
        delete publicGalleriesMap[key];
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      saveDatabaseToDisk();
    }

    console.log(`[Public Gallery Empty Trash] Owner: "${ownerId}", Deleted: ${deletedCount}`);
    return res.json({ success: true, deletedCount, remainingTotal: Object.keys(publicGalleriesMap).length });
  } catch (err: any) {
    console.error('[Public Gallery Empty Trash Error]', err);
    return res.status(500).json({ error: 'Gagal mengosongkan keranjang sampah pada server.', details: err.message });
  }
});

// ----------------- STUDIO BRANDING & LOGO MANAGEMENT API -----------------

// Helper to determine file extension and mime type
function getMimeAndExt(mimeOrFilename?: string): { mime: string; ext: string } {
  const str = (mimeOrFilename || '').toLowerCase();
  if (str.includes('png')) return { mime: 'image/png', ext: '.png' };
  if (str.includes('jpeg') || str.includes('jpg')) return { mime: 'image/jpeg', ext: '.jpg' };
  if (str.includes('webp')) return { mime: 'image/webp', ext: '.webp' };
  if (str.includes('svg')) return { mime: 'image/svg+xml', ext: '.svg' };
  return { mime: 'image/png', ext: '.png' };
}

// GET /api/studio/profile/:ownerId - Get persistent studio profile
app.get('/api/studio/profile/:ownerId', (req, res) => {
  const { ownerId } = req.params;
  if (!ownerId) return res.status(400).json({ error: 'ownerId wajib disertakan.' });
  
  const profile = studioProfilesMap[ownerId] || null;
  return res.json({ success: true, profile });
});

// POST /api/studio/profile - Save or update studio profile
app.post('/api/studio/profile', (req, res) => {
  try {
    const { ownerId, profile } = req.body;
    if (!ownerId || !profile) {
      return res.status(400).json({ error: 'ownerId dan data profile wajib disertakan.' });
    }

    const existing = (studioProfilesMap[ownerId] || {}) as Partial<PublicStudioInfo>;
    const updated: PublicStudioInfo = {
      studioName: profile.studioName || existing.studioName || 'Studio Foto',
      tagline: profile.tagline || existing.tagline || 'Professional Photography',
      logoUrl: profile.logoUrl || profile.studioLogoUrl || existing.logoUrl || existing.studioLogoUrl,
      studioLogoUrl: profile.studioLogoUrl || profile.logoUrl || existing.studioLogoUrl || existing.logoUrl,
      studioLogoPath: profile.studioLogoPath || existing.studioLogoPath,
      whatsappNumber: profile.whatsappNumber !== undefined ? profile.whatsappNumber : existing.whatsappNumber || '',
      instagram: profile.instagram !== undefined ? profile.instagram : existing.instagram || '',
      website: profile.website !== undefined ? profile.website : existing.website || '',
      address: profile.address !== undefined ? profile.address : existing.address || '',
      accentColor: profile.accentColor || existing.accentColor || '#2563eb',
      watermarkEnabled: profile.watermarkEnabled !== undefined ? profile.watermarkEnabled : existing.watermarkEnabled || false,
      watermarkText: profile.watermarkText !== undefined ? profile.watermarkText : existing.watermarkText || '',
      watermarkPosition: profile.watermarkPosition || existing.watermarkPosition || 'bottom-right',
      galleryFooterText: profile.galleryFooterText !== undefined ? profile.galleryFooterText : existing.galleryFooterText || '',
      welcomeMessage: profile.welcomeMessage !== undefined ? profile.welcomeMessage : existing.welcomeMessage || '',
      allowClientDownload: profile.allowClientDownload !== undefined ? profile.allowClientDownload : true,
      allowBatchZipDownload: profile.allowBatchZipDownload !== undefined ? profile.allowBatchZipDownload : true,
      customGalleryDomain: profile.customGalleryDomain !== undefined ? profile.customGalleryDomain : existing.customGalleryDomain,
      updatedAt: new Date().toISOString(),
    };

    studioProfilesMap[ownerId] = updated;
    saveProfilesToDisk();

    // Propagate updated studio profile to all public galleries belonging to this owner
    let updatedGalleriesCount = 0;
    for (const gId of Object.keys(publicGalleriesMap)) {
      if (publicGalleriesMap[gId].ownerId === ownerId || publicGalleriesMap[gId].ownerUid === ownerId) {
        publicGalleriesMap[gId].studio = { ...updated };
        publicGalleriesMap[gId].updatedAt = new Date().toISOString();
        updatedGalleriesCount++;
      }
    }
    if (updatedGalleriesCount > 0) {
      saveDatabaseToDisk();
    }

    console.log(`[Studio Profile Saved] Owner: ${ownerId} (${updated.studioName}), Updated Galleries: ${updatedGalleriesCount}`);
    return res.json({ success: true, profile: updated, updatedGalleriesCount });
  } catch (err: any) {
    console.error('[Studio Profile Save Error]', err);
    return res.status(500).json({ error: 'Gagal menyimpan profil studio.', details: err.message });
  }
});

// POST /api/studio/logo - Upload studio logo (per-user storage)
app.post('/api/studio/logo', (req, res) => {
  try {
    const { ownerId, logoBase64, fileName, mimeType } = req.body;
    if (!ownerId || !logoBase64) {
      return res.status(400).json({ error: 'ownerId dan logoBase64 wajib disertakan.' });
    }

    // 1. Parse base64 and mime type
    let cleanBase64 = logoBase64;
    let detectedMime = mimeType || 'image/png';

    if (logoBase64.startsWith('data:')) {
      const match = logoBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        detectedMime = match[1];
        cleanBase64 = match[2];
      }
    }

    const { mime, ext } = getMimeAndExt(detectedMime || fileName);

    // Validate mime type
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!allowedMimes.includes(mime)) {
      return res.status(400).json({ 
        error: 'Format file tidak didukung. Harap gunakan format PNG, JPG/JPEG, WebP, atau SVG.' 
      });
    }

    // 2. Decode buffer & validate size (Max 2MB)
    const buffer = Buffer.from(cleanBase64, 'base64');
    const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
    if (buffer.length > MAX_SIZE) {
      return res.status(400).json({ 
        error: `Ukuran file logo terlalu besar (${(buffer.length / (1024 * 1024)).toFixed(2)} MB). Maksimal 2 MB.` 
      });
    }

    if (buffer.length < 10) {
      return res.status(400).json({ error: 'File gambar kosong atau tidak valid.' });
    }

    // 3. Ensure logos directory exists
    if (!fs.existsSync(LOGOS_DIR)) {
      fs.mkdirSync(LOGOS_DIR, { recursive: true });
    }

    // 4. Clean old logo files for this owner
    const safeOwnerId = ownerId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const existingFiles = fs.readdirSync(LOGOS_DIR);
    for (const f of existingFiles) {
      if (f.startsWith(`${safeOwnerId}_logo`)) {
        try {
          fs.unlinkSync(path.join(LOGOS_DIR, f));
        } catch {}
      }
    }

    // 5. Write new logo file
    const targetFilename = `${safeOwnerId}_logo${ext}`;
    const targetPath = path.join(LOGOS_DIR, targetFilename);
    fs.writeFileSync(targetPath, buffer);

    const logoUrl = `/api/studio/logo/${encodeURIComponent(ownerId)}?v=${Date.now()}`;

    // 6. Update studio profile
    const existingProfile = studioProfilesMap[ownerId] || {
      studioName: 'Studio Foto',
      tagline: 'Professional Photography',
      whatsappNumber: '',
      instagram: '',
      website: '',
      address: '',
      accentColor: '#2563eb',
      watermarkEnabled: false,
      watermarkText: '',
      watermarkPosition: 'bottom-right',
      galleryFooterText: '',
      welcomeMessage: '',
      allowClientDownload: true,
      allowBatchZipDownload: true,
    };

    existingProfile.studioLogoUrl = logoUrl;
    existingProfile.logoUrl = logoUrl;
    existingProfile.studioLogoPath = targetPath;
    existingProfile.updatedAt = new Date().toISOString();

    studioProfilesMap[ownerId] = existingProfile;
    saveProfilesToDisk();

    // 7. Update all public galleries owned by this owner
    let updatedCount = 0;
    for (const gId of Object.keys(publicGalleriesMap)) {
      if (publicGalleriesMap[gId].ownerId === ownerId || publicGalleriesMap[gId].ownerUid === ownerId) {
        publicGalleriesMap[gId].studio.studioLogoUrl = logoUrl;
        publicGalleriesMap[gId].studio.logoUrl = logoUrl;
        publicGalleriesMap[gId].studio.studioLogoPath = targetPath;
        publicGalleriesMap[gId].updatedAt = new Date().toISOString();
        updatedCount++;
      }
    }
    if (updatedCount > 0) {
      saveDatabaseToDisk();
    }

    console.log(`[Studio Logo Uploaded] Owner: ${ownerId}, Saved: ${targetFilename}, Size: ${buffer.length} bytes, Updated Galleries: ${updatedCount}`);

    return res.json({ 
      success: true, 
      logoUrl, 
      studioLogoUrl: logoUrl,
      updatedGalleriesCount: updatedCount,
      message: 'Logo studio berhasil diperbarui.' 
    });
  } catch (err: any) {
    console.error('[Studio Logo Upload Error]', err);
    return res.status(500).json({ error: 'Gagal mengunggah logo studio.', details: err.message });
  }
});

// GET /api/studio/logo/:ownerId - Serve studio logo with proper caching and mime type
app.get('/api/studio/logo/:ownerId', (req, res) => {
  try {
    const { ownerId } = req.params;
    if (!ownerId) return res.status(400).send('Owner ID required');

    const safeOwnerId = ownerId.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!fs.existsSync(LOGOS_DIR)) {
      return res.status(404).send('Logo not found');
    }

    const files = fs.readdirSync(LOGOS_DIR);
    const matched = files.find((f) => f.startsWith(`${safeOwnerId}_logo`));

    if (!matched) {
      return res.status(404).send('Logo not found');
    }

    const filePath = path.join(LOGOS_DIR, matched);
    const { mime } = getMimeAndExt(matched);

    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
    return res.sendFile(filePath);
  } catch (err: any) {
    console.error('[Studio Logo Serve Error]', err);
    return res.status(500).send('Error serving logo');
  }
});

// DELETE /api/studio/logo/:ownerId - Remove studio logo
app.delete('/api/studio/logo/:ownerId', (req, res) => {
  try {
    const { ownerId } = req.params;
    if (!ownerId) return res.status(400).json({ error: 'ownerId required' });

    const safeOwnerId = ownerId.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (fs.existsSync(LOGOS_DIR)) {
      const files = fs.readdirSync(LOGOS_DIR);
      for (const f of files) {
        if (f.startsWith(`${safeOwnerId}_logo`)) {
          try {
            fs.unlinkSync(path.join(LOGOS_DIR, f));
          } catch {}
        }
      }
    }

    if (studioProfilesMap[ownerId]) {
      delete studioProfilesMap[ownerId].studioLogoUrl;
      delete studioProfilesMap[ownerId].logoUrl;
      delete studioProfilesMap[ownerId].studioLogoPath;
      studioProfilesMap[ownerId].updatedAt = new Date().toISOString();
      saveProfilesToDisk();
    }

    let updatedCount = 0;
    for (const gId of Object.keys(publicGalleriesMap)) {
      if (publicGalleriesMap[gId].ownerId === ownerId || publicGalleriesMap[gId].ownerUid === ownerId) {
        delete publicGalleriesMap[gId].studio.studioLogoUrl;
        delete publicGalleriesMap[gId].studio.logoUrl;
        delete publicGalleriesMap[gId].studio.studioLogoPath;
        publicGalleriesMap[gId].updatedAt = new Date().toISOString();
        updatedCount++;
      }
    }
    if (updatedCount > 0) {
      saveDatabaseToDisk();
    }

    console.log(`[Studio Logo Deleted] Owner: ${ownerId}, Updated Galleries: ${updatedCount}`);
    return res.json({ success: true, message: 'Logo studio berhasil dihapus.' });
  } catch (err: any) {
    console.error('[Studio Logo Delete Error]', err);
    return res.status(500).json({ error: 'Gagal menghapus logo studio.', details: err.message });
  }
});

// ----------------- STUDIO TOKEN REGISTRY & MEDIA DELIVERY -----------------

interface StudioTokenEntry {
  ownerId: string;
  token: string;
  expiresAt: number;
}

const studioTokensMap: Record<string, StudioTokenEntry> = {};

// POST /api/studio/token - Register studio OAuth token for backend proxy operations
app.post('/api/studio/token', (req, res) => {
  const { ownerId, token, expiresAt } = req.body;
  if (!ownerId || !token) {
    return res.status(400).json({ error: 'ownerId dan token wajib disertakan.' });
  }
  studioTokensMap[ownerId] = {
    ownerId,
    token,
    expiresAt: expiresAt || Date.now() + 3600 * 1000,
  };
  return res.json({ success: true });
});

// Helper to extract Google Drive File ID from URL or ID
function extractDriveFileId(idOrUrl?: string): string | null {
  if (!idOrUrl || typeof idOrUrl !== 'string') return null;
  const str = idOrUrl.trim();

  // If it's a raw Drive ID (alphanumeric, dashes, underscores, len 20-50) and not URL or mock
  if (
    !str.startsWith('http://') &&
    !str.startsWith('https://') &&
    !str.startsWith('blob:') &&
    !str.startsWith('data:') &&
    !str.startsWith('mock_') &&
    !str.startsWith('photo_') &&
    !str.startsWith('local_')
  ) {
    return str;
  }

  const thumbMatch = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (thumbMatch && thumbMatch[1] && !thumbMatch[1].startsWith('mock_')) {
    return thumbMatch[1];
  }

  const dMatch = str.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch && dMatch[1] && !dMatch[1].startsWith('mock_')) {
    return dMatch[1];
  }

  const lh3Match = str.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (lh3Match && lh3Match[1] && !lh3Match[1].startsWith('mock_')) {
    return lh3Match[1];
  }

  return null;
}

// In-memory media cache: key -> { buffer, contentType, timestamp }
const imageMemoryCache: Map<string, { buffer: Buffer; contentType: string; timestamp: number }> = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_CACHE_ENTRIES = 200;

function getCachedImage(key: string): { buffer: Buffer; contentType: string } | null {
  const item = imageMemoryCache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > CACHE_TTL_MS) {
    imageMemoryCache.delete(key);
    return null;
  }
  return { buffer: item.buffer, contentType: item.contentType };
}

function setCachedImage(key: string, buffer: Buffer, contentType: string) {
  if (imageMemoryCache.size >= MAX_CACHE_ENTRIES) {
    // Delete oldest entry
    const oldestKey = imageMemoryCache.keys().next().value;
    if (oldestKey) imageMemoryCache.delete(oldestKey);
  }
  imageMemoryCache.set(key, { buffer, contentType, timestamp: Date.now() });
}

/**
 * Fetches 100% Original Lossless Binary from Google Drive Master Storage.
 * NO resizing, NO re-encoding, NO WebP conversion, NO canvas degradation.
 */
async function fetchGoogleDriveMasterBinary(
  driveFileId: string,
  ownerId?: string,
  expectedSize?: number
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const cleanId = extractDriveFileId(driveFileId) || driveFileId.trim();
  if (!cleanId) return null;

  // 1. Authenticated Google Drive API Stream (Bearer Token)
  const tokenCandidates: string[] = [];
  if (ownerId && studioTokensMap[ownerId]?.token && studioTokensMap[ownerId].expiresAt > Date.now()) {
    tokenCandidates.push(studioTokensMap[ownerId].token);
  }
  for (const uid of Object.keys(studioTokensMap)) {
    const entry = studioTokensMap[uid];
    if (entry?.token && entry.expiresAt > Date.now() && !tokenCandidates.includes(entry.token)) {
      tokenCandidates.push(entry.token);
    }
  }

  for (const token of tokenCandidates) {
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${cleanId}?alt=media`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: '*/*',
        },
      });

      if (res.ok) {
        const ct = res.headers.get('content-type') || 'image/jpeg';
        if (!ct.includes('text/html') && !ct.includes('application/json')) {
          const ab = await res.arrayBuffer();
          const buf = Buffer.from(ab);
          if (buf.length > 0) {
            // Size sanity check: if expectedSize is known, ensure we didn't receive a micro preview
            if (!expectedSize || buf.length >= expectedSize * 0.6 || buf.length > 400_000) {
              console.log(`[Drive Master Binary] Fetched ${buf.length} bytes via Google Drive API for ${cleanId}`);
              return { buffer: buf, contentType: ct };
            }
          }
        }
      }
    } catch (e: any) {
      console.warn(`[Drive Master Fetch API Error] ID ${cleanId}:`, e.message);
    }
  }

  // 2. Direct Google Drive UC Export Download (Follows 302 redirects to doc-XX storage binary)
  const ucUrls = [
    `https://drive.google.com/uc?export=download&confirm=t&id=${cleanId}`,
    `https://drive.google.com/uc?export=download&id=${cleanId}`,
    `https://drive.usercontent.google.com/download?id=${cleanId}&export=download&confirm=t`,
  ];

  for (const u of ucUrls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: '*/*',
        },
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timeout);

      if (!res.ok) continue;

      const ct = res.headers.get('content-type') || 'image/jpeg';

      // If Google returned HTML virus scan confirmation page for large files (>25MB)
      if (ct.includes('text/html')) {
        const html = await res.text();
        const confirmMatch = html.match(/href="([^"]*(?:confirm=[^"&]+|download\?id=[^"]+))"/i);
        if (confirmMatch && confirmMatch[1]) {
          let confirmUrl = confirmMatch[1].replace(/&amp;/g, '&');
          if (confirmUrl.startsWith('/')) {
            confirmUrl = `https://drive.google.com${confirmUrl}`;
          }
          const cookieHeader = res.headers.get('set-cookie') || '';
          const confirmRes = await fetch(confirmUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              Accept: '*/*',
              ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            },
            redirect: 'follow',
          });
          if (confirmRes.ok) {
            const confirmCt = confirmRes.headers.get('content-type') || 'image/jpeg';
            if (!confirmCt.includes('text/html') && !confirmCt.includes('application/json')) {
              const ab = await confirmRes.arrayBuffer();
              const buf = Buffer.from(ab);
              if (buf.length > 0) {
                console.log(`[Drive Master Binary] Fetched ${buf.length} bytes via confirmation for ${cleanId}`);
                return { buffer: buf, contentType: confirmCt };
              }
            }
          }
        }
        continue;
      }

      if (!ct.includes('application/json')) {
        const ab = await res.arrayBuffer();
        const buf = Buffer.from(ab);
        if (buf.length > 0) {
          if (!expectedSize || buf.length >= expectedSize * 0.6 || buf.length > 400_000) {
            console.log(`[Drive Master Binary] Fetched ${buf.length} bytes via UC export for ${cleanId}`);
            return { buffer: buf, contentType: ct };
          }
        }
      }
    } catch (e: any) {
      console.warn(`[Drive Master Fetch UC Error] ID ${cleanId}:`, e.message);
    }
  }

  return null;
}

// GET /api/public/gallery/:galleryId/photos/:photoId/download - Dedicated 100% Original Photo Binary Downloader
app.get('/api/public/gallery/:galleryId/photos/:photoId/download', async (req, res) => {
  const { galleryId, photoId } = req.params;

  try {
    const target = galleryId.trim();
    let matchedGallery = publicGalleriesMap[target];
    if (!matchedGallery) {
      for (const k of Object.keys(publicGalleriesMap)) {
        if (k.toLowerCase() === target.toLowerCase() || (publicGalleriesMap[k].albumId && publicGalleriesMap[k].albumId.toLowerCase() === target.toLowerCase())) {
          matchedGallery = publicGalleriesMap[k];
          break;
        }
      }
    }

    if (!matchedGallery) {
      return res.status(404).json({ error: 'Galeri tidak ditemukan.' });
    }

    let photo = (matchedGallery.photos || []).find((p) => p.id === photoId || p.driveFileId === photoId);
    if (!photo) {
      for (const k of Object.keys(publicGalleriesMap)) {
        const found = (publicGalleriesMap[k].photos || []).find((p) => p.id === photoId || p.driveFileId === photoId);
        if (found) {
          photo = found;
          break;
        }
      }
    }

    if (!photo) {
      return res.status(404).json({ error: 'Foto tidak ditemukan dalam galeri ini.' });
    }

    const driveId = extractDriveFileId(photo.driveFileId) ||
                    extractDriveFileId(photo.downloadUrl) ||
                    extractDriveFileId(photo.previewUrl) ||
                    extractDriveFileId(photo.thumbnailUrl);

    if (driveId) {
      const master = await fetchGoogleDriveMasterBinary(driveId, matchedGallery.ownerId, photo.fileSize);
      if (master && master.buffer.length > 0) {
        const safeFilename = (photo.filename || 'foto_original.jpg').replace(/[\r\n"/\\]/g, '_');
        res.setHeader('Content-Type', master.contentType);
        res.setHeader('Content-Length', master.buffer.length.toString());
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFilename)}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`);
        res.setHeader('Cache-Control', 'private, no-cache, no-transform');
        return res.send(master.buffer);
      }
    }

    // Direct external HTTP link fallback if not drive
    if (photo.downloadUrl && photo.downloadUrl.startsWith('http') && !photo.downloadUrl.includes('drive.google.com/file/d/')) {
      const externalRes = await fetch(photo.downloadUrl, { redirect: 'follow' });
      if (externalRes.ok) {
        const ab = await externalRes.arrayBuffer();
        const buf = Buffer.from(ab);
        if (buf.length > 0) {
          const safeFilename = (photo.filename || 'foto_original.jpg').replace(/[\r\n"/\\]/g, '_');
          res.setHeader('Content-Type', externalRes.headers.get('content-type') || 'image/jpeg');
          res.setHeader('Content-Length', buf.length.toString());
          res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFilename)}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`);
          return res.send(buf);
        }
      }
    }

    return res.status(502).json({
      error: 'File original tidak dapat diunduh dari Google Drive. Silakan coba kembali.',
      photoId: photo.id,
      filename: photo.filename,
    });
  } catch (err: any) {
    console.error('[Download Photo Error]', err);
    return res.status(500).json({ error: 'Gagal mengunduh file original.', details: err.message });
  }
});

// GET /api/public/gallery/:galleryId/photos/:photoId/media - Fast Display Thumbnail & Preview Streamer
app.get('/api/public/gallery/:galleryId/photos/:photoId/media', async (req, res) => {
  const { galleryId, photoId } = req.params;
  const quality = (req.query.quality as string) || 'preview'; // thumb | preview | hd

  try {
    const target = galleryId.trim();
    let matchedGallery = publicGalleriesMap[target];
    if (!matchedGallery) {
      for (const k of Object.keys(publicGalleriesMap)) {
        if (k.toLowerCase() === target.toLowerCase() || (publicGalleriesMap[k].albumId && publicGalleriesMap[k].albumId.toLowerCase() === target.toLowerCase())) {
          matchedGallery = publicGalleriesMap[k];
          break;
        }
      }
    }

    if (!matchedGallery) {
      return res.status(404).json({ error: 'Galeri tidak ditemukan.' });
    }

    let photo = (matchedGallery.photos || []).find((p) => p.id === photoId || p.driveFileId === photoId);
    if (!photo) {
      for (const k of Object.keys(publicGalleriesMap)) {
        const found = (publicGalleriesMap[k].photos || []).find((p) => p.id === photoId || p.driveFileId === photoId);
        if (found) {
          photo = found;
          break;
        }
      }
    }

    if (!photo) {
      return res.status(404).json({ error: 'Foto tidak ditemukan dalam galeri ini.' });
    }

    const cacheKey = `${photo.id}_${quality}_${photo.driveFileId || ''}`;
    const cached = getCachedImage(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
      return res.send(cached.buffer);
    }

    const driveId = extractDriveFileId(photo.driveFileId) ||
                    extractDriveFileId(photo.previewUrl) ||
                    extractDriveFileId(photo.thumbnailUrl) ||
                    extractDriveFileId(photo.downloadUrl);

    const candidates: { url: string; authHeader?: string }[] = [];

    if (driveId) {
      const szParam = quality === 'thumb' ? 'w600' : quality === 'preview' ? 'w1600' : 'w2560';
      candidates.push({ url: `https://drive.google.com/thumbnail?id=${driveId}&sz=${szParam}` });
      candidates.push({ url: `https://lh3.googleusercontent.com/d/${driveId}=${szParam}` });
    }

    if (photo.thumbnailUrl && photo.thumbnailUrl.startsWith('http') && !photo.thumbnailUrl.includes('drive.google.com/file/d/')) {
      candidates.push({ url: photo.thumbnailUrl });
    }
    if (photo.previewUrl && photo.previewUrl.startsWith('http') && !photo.previewUrl.includes('drive.google.com/file/d/')) {
      candidates.push({ url: photo.previewUrl });
    }

    for (const item of candidates) {
      try {
        const upstreamRes = await fetch(item.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          },
          redirect: 'follow',
        });

        if (!upstreamRes.ok) continue;

        const contentType = upstreamRes.headers.get('content-type') || 'image/jpeg';
        if (contentType.includes('text/html') || contentType.includes('application/json')) continue;

        const arrayBuf = await upstreamRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        if (buffer.length === 0) continue;

        setCachedImage(cacheKey, buffer, contentType);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
        return res.send(buffer);
      } catch {
        // try next
      }
    }

    // Clean SVG Fallback for broken preview
    const fallbackSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" fill="#0f172a">
        <rect width="800" height="600" fill="#0f172a"/>
        <circle cx="400" cy="260" r="48" fill="#334155"/>
        <path d="M380 260 L400 240 L420 260" stroke="#94a3b8" stroke-width="4" fill="none" stroke-linecap="round"/>
        <text x="400" y="360" font-family="system-ui, sans-serif" font-size="20" font-weight="bold" fill="#e2e8f0" text-anchor="middle">${encodeURIComponent(photo.filename || 'Foto Galeri')}</text>
        <text x="400" y="390" font-family="system-ui, sans-serif" font-size="14" fill="#64748b" text-anchor="middle">Pratinjau Foto</text>
      </svg>
    `.trim();

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-cache');
    return res.send(Buffer.from(fallbackSvg, 'utf-8'));
  } catch (err: any) {
    console.error('[Media Proxy Error]', err);
    return res.status(500).json({ error: 'Gagal memuat pratinjau foto.', details: err.message });
  }
});

// GET /api/public/drive/:driveFileId/download - Universal 100% Original Google Drive Downloader
app.get('/api/public/drive/:driveFileId/download', async (req, res) => {
  const { driveFileId } = req.params;
  const rawFilename = (req.query.filename as string) || 'foto_original.jpg';
  const cleanDriveId = extractDriveFileId(driveFileId) || driveFileId.trim();

  if (!cleanDriveId) {
    return res.status(400).json({ error: 'driveFileId wajib disertakan.' });
  }

  const master = await fetchGoogleDriveMasterBinary(cleanDriveId);
  if (master && master.buffer.length > 0) {
    const safeFilename = rawFilename.replace(/[\r\n"/\\]/g, '_');
    res.setHeader('Content-Type', master.contentType);
    res.setHeader('Content-Length', master.buffer.length.toString());
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFilename)}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`);
    res.setHeader('Cache-Control', 'private, no-cache, no-transform');
    return res.send(master.buffer);
  }

  return res.status(502).json({
    error: 'File original tidak dapat diunduh dari Google Drive. Silakan coba kembali.',
    driveFileId: cleanDriveId,
    filename: rawFilename,
  });
});

// GET /api/public/gallery/:galleryId/zip - Full 100% Lossless Server-Side ZIP Generator & Streamer
app.get('/api/public/gallery/:galleryId/zip', async (req, res) => {
  const { galleryId } = req.params;

  try {
    const target = galleryId.trim();
    let matchedGallery = publicGalleriesMap[target];
    if (!matchedGallery) {
      for (const k of Object.keys(publicGalleriesMap)) {
        if (k.toLowerCase() === target.toLowerCase() || (publicGalleriesMap[k].albumId && publicGalleriesMap[k].albumId.toLowerCase() === target.toLowerCase())) {
          matchedGallery = publicGalleriesMap[k];
          break;
        }
      }
    }

    if (!matchedGallery) {
      return res.status(404).json({ error: 'Galeri tidak ditemukan.' });
    }

    const photos = (matchedGallery.photos || []).filter(p => !p.isDeleted);
    if (photos.length === 0) {
      return res.status(400).json({ error: 'Tidak ada foto untuk diunduh dalam galeri ini.' });
    }

    const zip = new JSZip();
    const cleanEvent = (matchedGallery.eventName || 'Galeri').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanCustomer = (matchedGallery.customerName || 'Foto').replace(/[^a-zA-Z0-9_-]/g, '_');
    const zipFilename = `${cleanEvent}_${cleanCustomer}_Foto_Original.zip`;

    let successCount = 0;

    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      const driveId = extractDriveFileId(p.driveFileId) || extractDriveFileId(p.downloadUrl) || extractDriveFileId(p.previewUrl);
      if (!driveId) continue;

      const master = await fetchGoogleDriveMasterBinary(driveId, matchedGallery.ownerId, p.fileSize);
      if (master && master.buffer.length > 0) {
        let relativePath = p.filename || `foto_${i + 1}.jpg`;
        if (p.albumId && p.albumId !== matchedGallery.albumId) {
          relativePath = `${p.albumId}/${relativePath}`;
        }
        zip.file(relativePath, master.buffer, { binary: true });
        successCount++;
      }
    }

    if (successCount === 0) {
      return res.status(502).json({
        error: 'File original tidak dapat diunduh dari Google Drive. Silakan coba kembali.',
      });
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', zipBuffer.length.toString());
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipFilename)}"; filename*=UTF-8''${encodeURIComponent(zipFilename)}`);
    res.setHeader('Cache-Control', 'private, no-cache, no-transform');
    return res.send(zipBuffer);
  } catch (err: any) {
    console.error('[Server ZIP Generator Error]', err);
    return res.status(500).json({ error: 'Gagal membuat arsip ZIP original.', details: err.message });
  }
});

// ----------------- VITE MIDDLEWARE / SPA SERVING -----------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
      },
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
    console.log(`[GaleriFotoQR Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
