import { PhotoItem } from '../types';
import { DEFAULT_ROOT_FOLDER_NAME, DEFAULT_CUSTOMER_ALBUMS_FOLDER } from '../config/appConfig';

const DRIVE_API_V3 = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_V3 = 'https://www.googleapis.com/upload/drive/v3';

interface DriveFolderResult {
  rootFolderId: string;
  customerAlbumsFolderId: string;
}

/**
 * Validates Google Drive access token with Google Drive API /about
 */
export async function validateDriveToken(accessToken: string): Promise<{ userEmail: string; userName: string }> {
  if (!accessToken || typeof accessToken !== 'string' || accessToken.trim() === '') {
    const errorMsg = 'Token akses Google Drive kosong atau tidak valid.';
    console.error(`[CREATE_ALBUM_ERROR]\nstage: drive_token_validation\nHTTP status: 401\nmessage: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  try {
    const res = await fetch(`${DRIVE_API_V3}/about?fields=user`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[CREATE_ALBUM_ERROR]\nstage: drive_token_validation\nHTTP status: ${res.status}\nmessage: ${errText || 'Token Google Drive expired'}`);
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Token akses Google Drive telah kedaluwarsa atau tidak memiliki izin (${res.status}). Silakan hubungkan ulang Google Drive.`);
      }
      throw new Error(`Gagal memverifikasi akses Google Drive (HTTP ${res.status}): ${errText}`);
    }

    const data = await res.json();
    return {
      userEmail: data.user?.emailAddress || '',
      userName: data.user?.displayName || '',
    };
  } catch (err: any) {
    if (err.name === 'TimeoutError') {
      console.error(`[CREATE_ALBUM_ERROR]\nstage: drive_token_validation\nHTTP status: 408\nmessage: Request timeout verifying Google Drive token`);
      throw new Error('Koneksi ke Google Drive timeout. Periksa sambungan internet Anda.');
    }
    throw err;
  }
}

/**
 * Ensures the Google Drive directory structure exists:
 * GaleriFotoQR Cloud Studio/
 *   └── Album Pelanggan/
 */
export async function ensureAppFolders(accessToken: string): Promise<DriveFolderResult> {
  if (!accessToken) {
    const err = 'Token akses Google Drive tidak ditemukan. Silakan login ulang.';
    console.error(`[CREATE_ALBUM_ERROR]\nstage: drive_token_validation\nHTTP status: 401\nmessage: ${err}`);
    throw new Error(err);
  }

  console.log('[GOOGLE_DRIVE] Ensuring app root folders exist...');

  // 1. Search for root app folder
  try {
    const rootQuery = encodeURIComponent(`name = '${DEFAULT_ROOT_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and 'root' in parents`);
    const rootRes = await fetch(`${DRIVE_API_V3}/files?q=${rootQuery}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15000),
    });

    if (!rootRes.ok) {
      const err = await rootRes.text().catch(() => '');
      console.error(`[CREATE_ALBUM_ERROR]\nstage: querying_root_folder\nHTTP status: ${rootRes.status}\nmessage: ${err}`);
      throw new Error(`Gagal membaca folder Google Drive (${rootRes.status}): ${err}`);
    }

    const rootData = await rootRes.json();
    let rootFolderId = rootData.files?.[0]?.id;

    if (!rootFolderId) {
      console.log('[GOOGLE_DRIVE] Creating root app folder:', DEFAULT_ROOT_FOLDER_NAME);
      const createRootRes = await fetch(`${DRIVE_API_V3}/files`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: DEFAULT_ROOT_FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder',
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!createRootRes.ok) {
        const createErr = await createRootRes.text().catch(() => '');
        console.error(`[CREATE_ALBUM_ERROR]\nstage: creating_root_folder\nHTTP status: ${createRootRes.status}\nmessage: ${createErr}`);
        throw new Error('Gagal membuat folder utama GaleriFotoQR di Google Drive.');
      }
      const newRoot = await createRootRes.json();
      rootFolderId = newRoot.id;
    }

    // 2. Search for Customer Albums folder inside root
    const subQuery = encodeURIComponent(`name = '${DEFAULT_CUSTOMER_ALBUMS_FOLDER}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and '${rootFolderId}' in parents`);
    const subRes = await fetch(`${DRIVE_API_V3}/files?q=${subQuery}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15000),
    });

    if (!subRes.ok) {
      const subErr = await subRes.text().catch(() => '');
      console.error(`[CREATE_ALBUM_ERROR]\nstage: querying_customer_folder\nHTTP status: ${subRes.status}\nmessage: ${subErr}`);
      throw new Error('Gagal memeriksa folder Album Pelanggan di Google Drive.');
    }

    const subData = await subRes.json();
    let customerAlbumsFolderId = subData.files?.[0]?.id;

    if (!customerAlbumsFolderId) {
      console.log('[GOOGLE_DRIVE] Creating sub folder:', DEFAULT_CUSTOMER_ALBUMS_FOLDER);
      const createSubRes = await fetch(`${DRIVE_API_V3}/files`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: DEFAULT_CUSTOMER_ALBUMS_FOLDER,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [rootFolderId],
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!createSubRes.ok) {
        const createSubErr = await createSubRes.text().catch(() => '');
        console.error(`[CREATE_ALBUM_ERROR]\nstage: creating_customer_folder\nHTTP status: ${createSubRes.status}\nmessage: ${createSubErr}`);
        throw new Error('Gagal membuat folder Album Pelanggan di Google Drive.');
      }
      const newSub = await createSubRes.json();
      customerAlbumsFolderId = newSub.id;
    }

    return { rootFolderId, customerAlbumsFolderId };
  } catch (error: any) {
    if (error.name === 'TimeoutError') {
      console.error(`[CREATE_ALBUM_ERROR]\nstage: ensure_app_folders\nHTTP status: 408\nmessage: Timeout contacting Google Drive`);
      throw new Error('Waktu koneksi Google Drive habis saat memeriksa folder aplikasi.');
    }
    throw error;
  }
}

/**
 * Creates a dedicated album folder under "Album Pelanggan"
 */
export async function createAlbumFolder(
  accessToken: string,
  albumName: string,
  galleryId: string,
  parentFolderId: string
): Promise<string> {
  const folderName = `${albumName} (${galleryId})`;
  console.log('[GOOGLE_DRIVE] Creating album folder:', folderName);

  try {
    const res = await fetch(`${DRIVE_API_V3}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      console.error(`[CREATE_ALBUM_ERROR]\nstage: create_drive_folder\nHTTP status: ${res.status}\nmessage: ${errorText}`);
      throw new Error(`Gagal membuat folder album di Google Drive (HTTP ${res.status}): ${errorText}`);
    }

    const folder = await res.json();
    const folderId = folder.id;

    // Make folder readable so public gallery can load images directly
    try {
      await fetch(`${DRIVE_API_V3}/files/${folderId}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
        signal: AbortSignal.timeout(10000),
      });
    } catch (permErr) {
      console.warn('[GOOGLE_DRIVE] Permission grant warning (non-fatal):', permErr);
    }

    return folderId;
  } catch (error: any) {
    if (error.name === 'TimeoutError') {
      console.error(`[CREATE_ALBUM_ERROR]\nstage: create_drive_folder\nHTTP status: 408\nmessage: Timeout creating folder on Google Drive`);
      throw new Error('Waktu koneksi Google Drive habis saat membuat folder album.');
    }
    throw error;
  }
}

/**
 * Uploads an ORIGINAL uncompressed photo directly to Google Drive
 */
export async function uploadOriginalPhoto(
  accessToken: string,
  folderId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<PhotoItem> {
  console.log(`[UPLOAD] Starting upload for ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB) to folder ${folderId}`);

  // Create multipart boundary
  const metadata = {
    name: file.name,
    mimeType: file.type || 'image/jpeg',
    parents: [folderId],
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const reader = new FileReader();
  const fileDataPromise = new Promise<ArrayBuffer>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Gagal membaca file lokal'));
    reader.readAsArrayBuffer(file);
  });

  const fileData = await fileDataPromise;

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
  const mediaHeader = `${delimiter}Content-Type: ${file.type || 'image/jpeg'}\r\nContent-Transfer-Encoding: base64\r\n\r\n`;

  // Convert buffer to base64 or construct multipart blob
  const metadataBlob = new Blob([metadataPart], { type: 'text/plain' });
  const mediaHeaderBlob = new Blob([mediaHeader], { type: 'text/plain' });
  const closeBlob = new Blob([closeDelimiter], { type: 'text/plain' });

  // Direct binary multipart
  const multipartBody = new Blob(
    [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      `--${boundary}\r\nContent-Type: ${file.type || 'image/jpeg'}\r\n\r\n`,
      fileData,
      `\r\n--${boundary}--`,
    ],
    { type: `multipart/related; boundary=${boundary}` }
  );

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${DRIVE_UPLOAD_V3}/files?uploadType=multipart&fields=id,name,size,mimeType,webViewLink,webContentLink,thumbnailLink,imageMediaMetadata`);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('Content-Type', `multipart/related; boundary=${boundary}`);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          console.log('[UPLOAD] Success file:', response.name, 'ID:', response.id);

          // Ensure anyone with link can view the photo
          await makeFilePublicReadable(accessToken, response.id);

          const photoItem: PhotoItem = {
            id: response.id,
            driveFileId: response.id,
            name: response.name || file.name,
            size: Number(response.size) || file.size,
            mimeType: response.mimeType || file.type || 'image/jpeg',
            webViewLink: response.webViewLink,
            webContentLink: response.webContentLink,
            thumbnailUrl: `https://lh3.googleusercontent.com/u/0/d/${response.id}=w1600` || response.thumbnailLink,
            downloadUrl: `https://drive.google.com/uc?export=download&id=${response.id}`,
            uploadedAt: new Date().toISOString(),
            width: response.imageMediaMetadata?.width,
            height: response.imageMediaMetadata?.height,
          };

          resolve(photoItem);
        } catch (e: any) {
          reject(new Error(`Gagal memproses respon Drive: ${e.message}`));
        }
      } else {
        reject(new Error(`Upload gagal dengan status HTTP ${xhr.status}: ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => reject(new Error('Koneksi terputus saat mengupload file ke Google Drive.'));
    xhr.ontimeout = () => reject(new Error('Waktu upload habis (timeout).'));
    xhr.send(multipartBody);
  });
}

/**
 * Grant anyone reader permission to a specific file
 */
export async function makeFilePublicReadable(accessToken: string, fileId: string): Promise<void> {
  try {
    await fetch(`${DRIVE_API_V3}/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    });
  } catch (e) {
    console.warn('[GOOGLE_DRIVE] Error setting public permission:', e);
  }
}

/**
 * Lists all photos in a Google Drive album folder
 */
export async function listPhotosInFolder(accessToken: string, folderId: string): Promise<PhotoItem[]> {
  console.log('[GOOGLE_DRIVE] Listing photos in folder:', folderId);
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false and mimeType contains 'image/'`);
  const fields = 'files(id,name,size,mimeType,webViewLink,webContentLink,thumbnailLink,imageMediaMetadata,createdTime)';

  const res = await fetch(`${DRIVE_API_V3}/files?q=${q}&fields=${fields}&pageSize=500&orderBy=name`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[GOOGLE_DRIVE] Failed to list folder photos:', err);
    throw new Error(`Gagal memuat daftar foto dari Google Drive (${res.status})`);
  }

  const data = await res.json();
  const files = data.files || [];

  return files.map((file: any) => ({
    id: file.id,
    driveFileId: file.id,
    name: file.name,
    size: Number(file.size) || 0,
    mimeType: file.mimeType,
    webViewLink: file.webViewLink,
    webContentLink: file.webContentLink,
    thumbnailUrl: `https://lh3.googleusercontent.com/u/0/d/${file.id}=w1600` || file.thumbnailLink,
    downloadUrl: `https://drive.google.com/uc?export=download&id=${file.id}`,
    uploadedAt: file.createdTime || new Date().toISOString(),
    width: file.imageMediaMetadata?.width,
    height: file.imageMediaMetadata?.height,
  }));
}

/**
 * Delete a photo from Google Drive (move to trash)
 */
export async function deleteDrivePhoto(accessToken: string, fileId: string): Promise<void> {
  const res = await fetch(`${DRIVE_API_V3}/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok && res.status !== 404) {
    throw new Error(`Gagal menghapus file dari Google Drive (${res.status})`);
  }
}

/**
 * Gets Google Drive storage quota info
 */
export async function getDriveStorageQuota(accessToken: string): Promise<{
  limit: number;
  usage: number;
  usageInDrive: number;
  usageInDriveTrash: number;
  userEmail: string;
  userName: string;
}> {
  const res = await fetch(`${DRIVE_API_V3}/about?fields=storageQuota,user`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error('Gagal mengambil informasi kuota Google Drive.');
  }

  const data = await res.json();
  const quota = data.storageQuota || {};
  const user = data.user || {};

  return {
    limit: Number(quota.limit) || 0,
    usage: Number(quota.usage) || 0,
    usageInDrive: Number(quota.usageInDrive) || 0,
    usageInDriveTrash: Number(quota.usageInDriveTrash) || 0,
    userEmail: user.emailAddress || '',
    userName: user.displayName || '',
  };
}
