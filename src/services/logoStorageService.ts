import { getStoredUserToken } from './googleAuth';
import { ensureAppFolders, uploadOriginalPhoto } from './googleDriveService';

const DRIVE_API_V3 = 'https://www.googleapis.com/drive/v3';

export const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
export const MAX_LOGO_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const MAX_BANNER_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Validates logo file format and size (max 5MB, PNG/JPG/WebP)
 */
export function validateLogoFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'File logo tidak ditemukan.' };
  }

  if (file.size > MAX_LOGO_FILE_SIZE) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Ukuran file logo terlalu besar (${sizeMb} MB). Maksimal ukuran file adalah 5 MB.`,
    };
  }

  const type = file.type ? file.type.toLowerCase() : '';
  const ext = file.name ? file.name.split('.').pop()?.toLowerCase() : '';

  const isAllowedMime = ALLOWED_LOGO_TYPES.includes(type);
  const isAllowedExt = ['png', 'jpg', 'jpeg', 'webp'].includes(ext || '');

  if (!isAllowedMime && !isAllowedExt) {
    return {
      valid: false,
      error: 'Format file tidak didukung. Harap pilih gambar dengan format PNG (direkomendasikan), JPG, atau WEBP.',
    };
  }

  return { valid: true };
}

/**
 * Validates banner file format and size (max 10MB, PNG/JPG/WebP)
 */
export function validateBannerFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'File banner tidak ditemukan.' };
  }

  if (file.size > MAX_BANNER_FILE_SIZE) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Ukuran file banner terlalu besar (${sizeMb} MB). Maksimal ukuran file adalah 10 MB.`,
    };
  }

  const type = file.type ? file.type.toLowerCase() : '';
  const ext = file.name ? file.name.split('.').pop()?.toLowerCase() : '';

  const isAllowedMime = ALLOWED_LOGO_TYPES.includes(type);
  const isAllowedExt = ['png', 'jpg', 'jpeg', 'webp'].includes(ext || '');

  if (!isAllowedMime && !isAllowedExt) {
    return {
      valid: false,
      error: 'Format banner tidak didukung. Harap gunakan gambar PNG, JPG, JPEG, atau WEBP.',
    };
  }

  return { valid: true };
}

/**
 * Converts image file to high-quality Data URL with 100% alpha transparency preserved.
 */
export async function fileToOptimizedDataUrl(file: File, maxDim = 800): Promise<string> {
  // If file is already small (under 400KB), preserve byte-for-byte
  if (file.size <= 400 * 1024) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const mime = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
        const dataUrl = canvas.toDataURL(mime, 0.95);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Gagal memproses gambar.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads branding asset (logo or banner) to 'GaleriFotoQR Cloud Studio/Branding' in user's Google Drive
 */
export async function uploadBrandingAssetToDrive(
  accessToken: string,
  file: File,
  prefix: 'logo' | 'banner' = 'logo'
): Promise<string> {
  const { rootFolderId } = await ensureAppFolders(accessToken);

  // Search or create 'Branding' subfolder inside root folder
  let brandingFolderId = rootFolderId;
  try {
    const brandingQuery = encodeURIComponent(
      `name = 'Branding' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and '${rootFolderId}' in parents`
    );
    const searchRes = await fetch(`${DRIVE_API_V3}/files?q=${brandingQuery}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        brandingFolderId = searchData.files[0].id;
      } else {
        const createRes = await fetch(`${DRIVE_API_V3}/files`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Branding',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [rootFolderId],
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (createRes.ok) {
          const createData = await createRes.json();
          brandingFolderId = createData.id || rootFolderId;
        }
      }
    }
  } catch (err) {
    console.warn(`[BRANDING_UPLOAD] Error searching/creating Branding folder, using root:`, err);
  }

  // Upload original file with public permissions
  const uploaded = await uploadOriginalPhoto(accessToken, brandingFolderId, file);
  return (
    uploaded.thumbnailUrl ||
    uploaded.webViewLink ||
    `https://lh3.googleusercontent.com/u/0/d/${uploaded.driveFileId}=w1600`
  );
}

export async function uploadLogoToGoogleDrive(accessToken: string, file: File): Promise<string> {
  return uploadBrandingAssetToDrive(accessToken, file, 'logo');
}

export async function uploadBannerToGoogleDrive(accessToken: string, file: File): Promise<string> {
  return uploadBrandingAssetToDrive(accessToken, file, 'banner');
}

/**
 * Universal logo processor:
 * 1. Checks if Google Drive is connected for current user -> uploads to Google Drive.
 * 2. If Google Drive is not connected or upload fails -> converts to high-quality Data URL with full PNG transparency.
 */
export async function processStudioLogo(userId: string, file: File): Promise<string> {
  const token = getStoredUserToken(userId);
  if (token) {
    try {
      console.log('[LOGO_STORAGE] Attempting upload to user Google Drive...');
      const driveUrl = await uploadLogoToGoogleDrive(token, file);
      if (driveUrl) {
        console.log('[LOGO_STORAGE] Successfully uploaded to Drive:', driveUrl);
        return driveUrl;
      }
    } catch (err) {
      console.warn('[LOGO_STORAGE] Drive upload failed, falling back to Data URL:', err);
    }
  }

  console.log('[LOGO_STORAGE] Processing logo as high-quality Data URL...');
  return await fileToOptimizedDataUrl(file, 800);
}

/**
 * Universal banner processor:
 * 1. Checks if Google Drive is connected for current user -> uploads to Google Drive.
 * 2. If Google Drive is not connected or upload fails -> converts to high-resolution landscape Data URL.
 */
export async function processStudioBanner(userId: string, file: File): Promise<string> {
  const token = getStoredUserToken(userId);
  if (token) {
    try {
      console.log('[BANNER_STORAGE] Attempting banner upload to user Google Drive...');
      const driveUrl = await uploadBannerToGoogleDrive(token, file);
      if (driveUrl) {
        console.log('[BANNER_STORAGE] Successfully uploaded banner to Drive:', driveUrl);
        return driveUrl;
      }
    } catch (err) {
      console.warn('[BANNER_STORAGE] Drive banner upload failed, falling back to Data URL:', err);
    }
  }

  console.log('[BANNER_STORAGE] Processing banner as high-resolution Data URL...');
  return await fileToOptimizedDataUrl(file, 1600);
}
