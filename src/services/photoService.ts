import { Photo } from '../types';
import JSZip from 'jszip';

export type PhotoQuality = 'thumb' | 'preview' | 'hd' | 'download';

/**
 * Formats file size in bytes to human-readable string:
 * - < 1 MB: formatted in KB (e.g. "245 KB", "850 KB")
 * - >= 1 MB: formatted in MB (e.g. "1.2 MB", "4.8 MB", "12.6 MB")
 * - >= 1 GB: formatted in GB (e.g. "1.2 GB")
 * Max 1-2 decimal places.
 */
export function formatPhotoSize(bytes?: number): string {
  if (bytes === undefined || bytes === null || typeof bytes !== 'number' || isNaN(bytes) || bytes <= 0) {
    return '';
  }

  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    // Keep 1 decimal e.g. 1.2 MB, 4.8 MB, 12.6 MB
    return `${Number(mb.toFixed(mb >= 100 ? 0 : 1))} MB`;
  }

  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}

/**
 * Formats photo resolution/dimensions (e.g. "4000 × 6000 px")
 */
export function formatPhotoDimensions(width?: number, height?: number): string {
  if (!width || !height || width <= 0 || height <= 0) {
    return '';
  }
  return `${width} × ${height} px`;
}

/**
 * Formats combined photo metadata string (e.g. "2.4 MB • 4000 × 6000 px")
 */
export function formatPhotoMeta(photo: { fileSize?: number; width?: number; height?: number }): string {
  if (!photo) return '';
  const sizeStr = formatPhotoSize(photo.fileSize);
  const dimStr = formatPhotoDimensions(photo.width, photo.height);

  if (sizeStr && dimStr) {
    return `${sizeStr} • ${dimStr}`;
  }
  return sizeStr || dimStr || '';
}

// In-memory & localStorage metadata cache to avoid repeated Drive API calls
const DRIVE_META_CACHE_KEY = 'galerifotoqr_drive_meta_cache';
let memDriveMetaCache: Record<string, { size?: number; width?: number; height?: number }> | null = null;

function getDriveMetaCache(): Record<string, { size?: number; width?: number; height?: number }> {
  if (memDriveMetaCache) return memDriveMetaCache;
  try {
    const raw = localStorage.getItem(DRIVE_META_CACHE_KEY);
    memDriveMetaCache = raw ? JSON.parse(raw) : {};
  } catch {
    memDriveMetaCache = {};
  }
  return memDriveMetaCache || {};
}

function saveDriveMetaCache(cache: Record<string, { size?: number; width?: number; height?: number }>) {
  memDriveMetaCache = cache;
  try {
    localStorage.setItem(DRIVE_META_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

/**
 * Gets cached Google Drive file metadata if available
 */
export function getCachedDriveMeta(driveFileId: string): { size?: number; width?: number; height?: number } | null {
  if (!driveFileId) return null;
  const cache = getDriveMetaCache();
  return cache[driveFileId] || null;
}

/**
 * Caches metadata for a Google Drive file ID
 */
export function setCachedDriveMeta(
  driveFileId: string,
  meta: { size?: number; width?: number; height?: number }
) {
  if (!driveFileId) return;
  const cache = getDriveMetaCache();
  cache[driveFileId] = { ...cache[driveFileId], ...meta };
  saveDriveMetaCache(cache);
}

/**
 * Extracts Google Drive file ID from various URL patterns or raw ID
 */
export function extractDriveFileId(idOrUrl?: string): string | null {
  if (!idOrUrl || typeof idOrUrl !== 'string') return null;
  const str = idOrUrl.trim();

  // If it's a raw file ID (alphanumeric, underscores, hyphens, usually 20-50 chars) and not a full URL
  if (!str.startsWith('http://') && !str.startsWith('https://') && !str.startsWith('blob:') && !str.startsWith('data:')) {
    if (!str.startsWith('mock_file_') && !str.startsWith('photo_') && !str.startsWith('local_')) {
      return str;
    }
  }

  // Check /thumbnail?id=FILE_ID
  const thumbMatch = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (thumbMatch && thumbMatch[1] && !thumbMatch[1].startsWith('mock_')) {
    return thumbMatch[1];
  }

  // Check /d/FILE_ID or /file/d/FILE_ID
  const dMatch = str.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch && dMatch[1] && !dMatch[1].startsWith('mock_')) {
    return dMatch[1];
  }

  // Check googleusercontent.com/d/FILE_ID
  const lh3Match = str.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (lh3Match && lh3Match[1] && !lh3Match[1].startsWith('mock_')) {
    return lh3Match[1];
  }

  return null;
}

/**
 * Resolves a safe, direct image URL for a photo (used as direct URL or fallback)
 * Ensures NO Google Drive HTML view pages are ever used as <img> src.
 */
export function resolveDirectPhotoUrl(photo: Photo, quality: PhotoQuality = 'preview'): string {
  if (!photo) return '';

  // 1. If it's a local object blob or data URL, return directly
  if (photo.thumbnailUrl?.startsWith('blob:') || photo.previewUrl?.startsWith('blob:')) {
    return quality === 'thumb' ? photo.thumbnailUrl : (photo.previewUrl || photo.thumbnailUrl);
  }
  if (photo.thumbnailUrl?.startsWith('data:') || photo.previewUrl?.startsWith('data:')) {
    return quality === 'thumb' ? photo.thumbnailUrl : (photo.previewUrl || photo.thumbnailUrl);
  }

  // 2. Check if there is a real Google Drive file ID
  const driveId = extractDriveFileId(photo.driveFileId) || 
                  extractDriveFileId(photo.previewUrl) || 
                  extractDriveFileId(photo.thumbnailUrl) ||
                  extractDriveFileId(photo.downloadUrl);

  if (driveId) {
    if (quality === 'thumb') {
      return `https://drive.google.com/thumbnail?id=${driveId}&sz=w600`;
    }
    if (quality === 'preview') {
      return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1600`;
    }
    if (quality === 'hd') {
      return `https://drive.google.com/thumbnail?id=${driveId}&sz=w2560`;
    }
    // quality === 'download' -> 100% untouched master binary
    return `https://lh3.googleusercontent.com/d/${driveId}`;
  }

  // 3. For Demo Unsplash or other standard image URLs
  if (quality === 'thumb') {
    return photo.thumbnailUrl || photo.previewUrl || photo.downloadUrl || '';
  }
  if (quality === 'preview') {
    return photo.previewUrl || photo.thumbnailUrl || photo.downloadUrl || '';
  }
  // hd or download
  return photo.downloadUrl || photo.previewUrl || photo.thumbnailUrl || '';
}

/**
 * Unified Public Photo Resolver for UI Display (Preview / Thumb / HD)
 */
export function getPublicPhotoUrl(
  photo: Photo,
  quality: PhotoQuality = 'preview',
  galleryId?: string
): string {
  if (!photo) return '';

  // Local object URL handling (e.g. during live upload in Studio before sync)
  if (photo.previewUrl?.startsWith('blob:') || photo.thumbnailUrl?.startsWith('blob:')) {
    return (quality === 'thumb' ? photo.thumbnailUrl : photo.previewUrl) || photo.thumbnailUrl;
  }

  if (galleryId && galleryId.trim().length > 0) {
    return `/api/public/gallery/${encodeURIComponent(galleryId.trim())}/photos/${encodeURIComponent(photo.id)}/media?quality=${quality}`;
  }

  return resolveDirectPhotoUrl(photo, quality);
}

/**
 * Returns prioritized URL candidates for downloading 100% original master binary from Google Drive.
 * NO googleusercontent thumbnails, NO preview links.
 */
export function getOriginalPhotoDownloadUrls(photo: Photo, galleryId?: string): string[] {
  if (!photo) return [];

  const list: string[] = [];

  // Local blob URL handling
  if (photo.downloadUrl?.startsWith('blob:') || photo.previewUrl?.startsWith('blob:')) {
    return [photo.downloadUrl || photo.previewUrl || ''];
  }

  const driveId = extractDriveFileId(photo.driveFileId) || 
                  extractDriveFileId(photo.downloadUrl) || 
                  extractDriveFileId(photo.previewUrl) ||
                  extractDriveFileId(photo.thumbnailUrl);

  const safeFilename = encodeURIComponent(photo.filename || 'foto_original.jpg');

  // 1. Dedicated Gallery Photo Download endpoint (Backend proxies exact raw master binary)
  if (galleryId && galleryId.trim().length > 0) {
    list.push(`/api/public/gallery/${encodeURIComponent(galleryId.trim())}/photos/${encodeURIComponent(photo.id)}/download`);
  }

  // 2. Universal Drive File Master Download endpoint (Direct original master binary proxy)
  if (driveId) {
    list.push(`/api/public/drive/${encodeURIComponent(driveId)}/download?filename=${safeFilename}`);
    list.push(`https://drive.google.com/uc?export=download&confirm=t&id=${driveId}`);
    list.push(`https://drive.google.com/uc?export=download&id=${driveId}`);
    list.push(`https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=t`);
  }

  // 3. Fallback direct downloadUrl if distinct and not a web viewer link
  if (photo.downloadUrl && !photo.downloadUrl.includes('drive.google.com/file/d/') && !photo.downloadUrl.includes('googleusercontent.com')) {
    list.push(photo.downloadUrl);
  }

  return list;
}

/**
 * Fetches the 100% untouched original binary file and triggers direct browser download.
 * NEVER resizes, compresses, or re-encodes the photo.
 * NEVER opens a new browser tab.
 */
export async function downloadOriginalPhotoFile(photo: Photo, galleryId?: string): Promise<void> {
  const candidateUrls = getOriginalPhotoDownloadUrls(photo, galleryId);

  let downloadSucceeded = false;
  let lastErrorMsg = '';

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: '*/*',
        },
      });

      if (!res.ok) {
        lastErrorMsg = `HTTP ${res.status}`;
        continue;
      }

      const contentType = res.headers.get('content-type') || '';
      // Reject HTML (e.g. Google login prompt) or JSON error responses
      if (contentType.includes('text/html') || contentType.includes('application/json')) {
        lastErrorMsg = 'Server returned non-binary response';
        continue;
      }

      const blob = await res.blob();
      if (blob.size === 0) {
        lastErrorMsg = 'File kosong (0 bytes)';
        continue;
      }

      // Verification: if photo fileSize is known (>500KB), ensure blob is not a tiny preview
      const expectedSize = photo.fileSize || photo.size;
      if (expectedSize && expectedSize > 500_000 && blob.size < expectedSize * 0.5) {
        lastErrorMsg = `Ukuran file diterima (${blob.size} B) tidak sesuai dengan file original (${expectedSize} B)`;
        continue;
      }

      // 100% Lossless direct browser download trigger
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = photo.filename || 'foto_original.jpg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 45000);

      downloadSucceeded = true;
      break;
    } catch (err: any) {
      lastErrorMsg = err.message || 'Fetch failed';
    }
  }

  if (!downloadSucceeded) {
    console.error('[Download Original Photo Error] Failed all candidates:', lastErrorMsg);
    throw new Error('File original tidak dapat diunduh dari Google Drive. Silakan coba kembali.');
  }
}

/**
 * Downloads multiple photos as a ZIP archive with 100% original master binary passthrough.
 * NO canvas decoding, NO JPEG re-encoding, NO resizing, NO preview caching.
 * Retains original folder structure if folderPath is present.
 */
export async function downloadOriginalPhotosZip(
  photos: Photo[],
  zipFilename: string,
  onProgress?: (percent: number, currentFileName: string) => void,
  galleryId?: string
): Promise<{ success: boolean; totalDownloaded: number; failedCount: number }> {
  if (!photos || photos.length === 0) {
    throw new Error('Tidak ada foto untuk diunduh.');
  }

  const zip = new JSZip();
  let downloadedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const candidateUrls = getOriginalPhotoDownloadUrls(photo, galleryId);
    let fileBlob: Blob | null = null;

    if (onProgress) {
      const pct = Math.round((i / photos.length) * 90);
      onProgress(pct, photo.filename || `foto_${i + 1}.jpg`);
    }

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, { headers: { Accept: '*/*' } });
        if (!res.ok) continue;

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('text/html') || contentType.includes('application/json')) {
          continue;
        }

        const blob = await res.blob();
        if (blob.size === 0) continue;

        // Size check: ensure we didn't receive a micro preview when original is multi-MB
        const expectedSize = photo.fileSize || photo.size;
        if (expectedSize && expectedSize > 500_000 && blob.size < expectedSize * 0.5) {
          continue;
        }

        fileBlob = blob;
        break;
      } catch {
        // try next candidate URL
      }
    }

    if (fileBlob) {
      // Build relative path inside ZIP (preserving folder hierarchy)
      let relativePath = photo.filename || `foto_${i + 1}.jpg`;
      if (photo.folderPath && photo.folderPath.trim()) {
        relativePath = `${photo.folderPath.trim()}/${relativePath}`;
      } else if (photo.folderName && photo.folderName.trim() && photo.folderName.trim() !== 'Foto Langsung') {
        relativePath = `${photo.folderName.trim()}/${relativePath}`;
      }

      // Add untouched raw original bytes directly into ZIP container
      zip.file(relativePath, fileBlob, { binary: true });
      downloadedCount++;
    } else {
      failedCount++;
      console.warn(`[ZIP] Failed to fetch original binary for ${photo.filename}`);
    }
  }

  if (downloadedCount === 0) {
    throw new Error('File original tidak dapat diunduh dari Google Drive. Silakan coba kembali.');
  }

  if (onProgress) {
    onProgress(95, 'Membuat arsip ZIP tanpa kompresi file...');
  }

  // Generate lossless ZIP container (DEFLATE container compression, raw untouched image bytes)
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  if (onProgress) {
    onProgress(100, 'Selesai!');
  }

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipFilename.endsWith('.zip') ? zipFilename : `${zipFilename}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 45000);

  return {
    success: true,
    totalDownloaded: downloadedCount,
    failedCount,
  };
}

/**
 * Preloads an image into the browser cache
 * Rejects with technical error details if load fails
 */
export function preloadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error('URL foto kosong.'));
      return;
    }
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => resolve(img);
    img.onerror = () => {
      reject(new Error(`Gagal memuat pratinjau gambar: ${src.substring(0, 100)}...`));
    };
    img.src = src;
  });
}
