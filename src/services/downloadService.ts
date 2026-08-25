import JSZip from 'jszip';
import { PhotoItem } from '../types';

/**
 * Downloads a single original photo as a file attachment (without opening in new tab)
 */
export async function downloadSinglePhoto(photo: PhotoItem): Promise<void> {
  console.log('[DOWNLOAD] Downloading original photo:', photo.name, 'ID:', photo.driveFileId);

  try {
    // Attempt direct download URL first
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${photo.driveFileId}`;
    
    // Fetch blob so browser triggers true download dialog
    const res = await fetch(downloadUrl);
    if (!res.ok) {
      // Fallback: try thumbnail full resolution or webContentLink
      const fallbackUrl = photo.webContentLink || photo.thumbnailUrl || downloadUrl;
      const fallbackRes = await fetch(fallbackUrl);
      if (!fallbackRes.ok) throw new Error('Gagal mengambil file foto asli dari Google Drive.');
      
      const blob = await fallbackRes.blob();
      triggerBlobDownload(blob, photo.name);
      return;
    }

    const blob = await res.blob();
    triggerBlobDownload(blob, photo.name);
  } catch (error) {
    console.warn('[DOWNLOAD] Direct blob fetch restricted by CORS, triggering native link download:', error);
    
    // Fallback trigger using hidden anchor
    const link = document.createElement('a');
    link.href = `https://drive.google.com/uc?export=download&id=${photo.driveFileId}`;
    link.download = photo.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Downloads multiple original photos and packages them into a ZIP archive
 */
export async function downloadPhotosAsZip(
  photos: PhotoItem[],
  zipFilename: string,
  onProgress?: (percent: number, currentItem: string) => void
): Promise<void> {
  if (!photos || photos.length === 0) {
    throw new Error('Tidak ada foto yang dipilih untuk diunduh.');
  }

  console.log(`[ZIP] Starting ZIP generation for ${photos.length} photos: ${zipFilename}`);
  const zip = new JSZip();
  let completed = 0;

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const currentName = photo.name || `photo_${i + 1}.jpg`;
    
    if (onProgress) {
      const pct = Math.round((completed / photos.length) * 80);
      onProgress(pct, `Mengunduh ${currentName} (${i + 1}/${photos.length})...`);
    }

    try {
      // Primary download link
      const directUrl = `https://drive.google.com/uc?export=download&id=${photo.driveFileId}`;
      let res = await fetch(directUrl);
      
      if (!res.ok) {
        // Fallback to high-res thumbnail link
        const fallbackUrl = `https://lh3.googleusercontent.com/u/0/d/${photo.driveFileId}=w2400`;
        res = await fetch(fallbackUrl);
      }

      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        zip.file(currentName, arrayBuffer);
      } else {
        console.warn(`[ZIP] Could not fetch ${currentName}, skipping in ZIP.`);
      }
    } catch (err) {
      console.warn(`[ZIP] Error reading photo ${currentName}:`, err);
    }

    completed++;
  }

  if (onProgress) {
    onProgress(90, 'Mengompresi file ZIP...');
  }

  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      if (onProgress) {
        const pct = 90 + Math.round((metadata.percent / 100) * 10);
        onProgress(pct, `Mengemas arsip ZIP: ${metadata.percent.toFixed(0)}%`);
      }
    }
  );

  console.log(`[ZIP] ZIP file ready (${(zipBlob.size / 1024 / 1024).toFixed(2)} MB), triggering download...`);
  const safeZipName = zipFilename.endsWith('.zip') ? zipFilename : `${zipFilename}.zip`;
  triggerBlobDownload(zipBlob, safeZipName);

  if (onProgress) {
    onProgress(100, 'Pengunduhan ZIP selesai!');
  }
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 1500);
}
