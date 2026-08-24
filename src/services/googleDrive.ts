import { GOOGLE_CONFIG } from '../config/googleConfig';
import { DriveStorageQuota } from '../types';

interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
  size?: string;
}

/**
 * Searches for a folder by name inside a parent folder (or 'root')
 */
export async function findDriveFolder(
  accessToken: string,
  folderName: string,
  parentFolderId: string = 'root'
): Promise<DriveFileMetadata | null> {
  const query = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName.replace(
    /'/g,
    "\\'"
  )}' and '${parentFolderId}' in parents and trashed = false`;

  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id,name,mimeType,webViewLink)&pageSize=1`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('AUTH_EXPIRED: Token Google Drive telah kedaluwarsa. Silakan hubungkan kembali.');
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gagal mencari folder di Google Drive.');
  }

  const data = await res.json();
  return data.files && data.files.length > 0 ? data.files[0] : null;
}

/**
 * Creates a new folder in Google Drive
 */
export async function createDriveFolder(
  accessToken: string,
  folderName: string,
  parentFolderId: string = 'root'
): Promise<DriveFileMetadata> {
  const body = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentFolderId],
  };

  const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('AUTH_EXPIRED: Sesi Google Drive berakhir.');
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gagal membuat folder "${folderName}" di Google Drive.`);
  }

  return await res.json();
}

/**
 * Initializes the default root folder structure in the user's Google Drive:
 * GaleriFotoQR/
 * ├── Album Pelanggan/
 * └── App Data/
 */
export async function initAppDriveStructure(
  accessToken: string
): Promise<{ rootFolderId: string; albumsFolderId: string; rootUrl?: string }> {
  // 1. Check or create GaleriFotoQR root folder
  let rootFolder = await findDriveFolder(accessToken, GOOGLE_CONFIG.rootFolderName, 'root');
  if (!rootFolder) {
    rootFolder = await createDriveFolder(accessToken, GOOGLE_CONFIG.rootFolderName, 'root');
  }

  // 2. Check or create "Album Pelanggan" inside root
  let albumsFolder = await findDriveFolder(accessToken, GOOGLE_CONFIG.albumFolderName, rootFolder.id);
  if (!albumsFolder) {
    albumsFolder = await createDriveFolder(accessToken, GOOGLE_CONFIG.albumFolderName, rootFolder.id);
  }

  // 3. Ensure folder is accessible or readable for web preview if needed
  try {
    await makeDriveFilePublicReader(accessToken, rootFolder.id);
    await makeDriveFilePublicReader(accessToken, albumsFolder.id);
  } catch {
    // Non-blocking permission setting
  }

  return {
    rootFolderId: rootFolder.id,
    albumsFolderId: albumsFolder.id,
    rootUrl: rootFolder.webViewLink,
  };
}

/**
 * Shares a folder or file to anyone with reader permission for public customer galleries
 */
export async function makeDriveFilePublicReader(accessToken: string, fileId: string): Promise<void> {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'reader',
      type: 'anyone',
    }),
  }).catch(() => {});
}

/**
 * Creates an individual customer album folder
 */
export async function createAlbumDriveFolder(
  accessToken: string,
  albumTitle: string,
  parentAlbumsFolderId: string
): Promise<DriveFileMetadata> {
  const folder = await createDriveFolder(accessToken, albumTitle, parentAlbumsFolderId);
  try {
    await makeDriveFilePublicReader(accessToken, folder.id);
  } catch {
    // ignore
  }
  return folder;
}

/**
 * Creates or retrieves a nested hierarchy of folders in Google Drive.
 * E.g. pathSegments = ["01. Akad", "Persiapan"] creates "01. Akad" under parentFolderId,
 * then "Persiapan" under "01. Akad", returning the deepest folder ID.
 */
export async function getOrCreateDriveFolderPath(
  accessToken: string,
  parentFolderId: string,
  pathSegments: string[],
  folderCache: Map<string, string> = new Map()
): Promise<string> {
  let currentParentId = parentFolderId;

  for (const segment of pathSegments) {
    if (!segment || !segment.trim()) continue;
    const cleanSegment = segment.trim();
    const cacheKey = `${currentParentId}:::${cleanSegment}`;

    if (folderCache.has(cacheKey)) {
      currentParentId = folderCache.get(cacheKey)!;
      continue;
    }

    // Check if folder exists
    let folder: DriveFileMetadata | null = null;
    try {
      folder = await findDriveFolder(accessToken, cleanSegment, currentParentId);
    } catch {
      folder = null;
    }

    if (!folder) {
      folder = await createDriveFolder(accessToken, cleanSegment, currentParentId);
      try {
        await makeDriveFilePublicReader(accessToken, folder.id);
      } catch {
        // ignore
      }
    }

    folderCache.set(cacheKey, folder.id);
    currentParentId = folder.id;
  }

  return currentParentId;
}

/**
 * Uploads a photo to Google Drive using multipart upload
 */
export async function uploadPhotoFileToDrive(
  accessToken: string,
  folderId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<{
  id: string;
  name: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  webViewLink: string;
  webContentLink?: string;
  thumbnailUrl: string;
  previewUrl: string;
  downloadUrl: string;
}> {
  const metadata = {
    name: file.name,
    mimeType: file.type || 'image/jpeg',
    parents: [folderId],
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const reader = new FileReader();
  const fileData = await new Promise<ArrayBuffer>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Gagal membaca file foto dari memori.'));
    reader.readAsArrayBuffer(file);
  });

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
    metadata
  )}\r\n`;

  const headerPart = `${delimiter}Content-Type: ${file.type || 'image/jpeg'}\r\nContent-Transfer-Encoding: binary\r\n\r\n`;

  // Create combined multipart body
  const metaEncoder = new TextEncoder();
  const metaEncoded = metaEncoder.encode(metadataPart);
  const headerEncoded = metaEncoder.encode(headerPart);
  const closeEncoded = metaEncoder.encode(closeDelimiter);

  const combinedLength = metaEncoded.byteLength + headerEncoded.byteLength + fileData.byteLength + closeEncoded.byteLength;
  const combinedBuffer = new Uint8Array(combinedLength);

  let offset = 0;
  combinedBuffer.set(metaEncoded, offset);
  offset += metaEncoded.byteLength;
  combinedBuffer.set(headerEncoded, offset);
  offset += headerEncoded.byteLength;
  combinedBuffer.set(new Uint8Array(fileData), offset);
  offset += fileData.byteLength;
  combinedBuffer.set(closeEncoded, offset);

  // Use XMLHttpRequest to track progress
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      'POST',
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,webContentLink,thumbnailLink,imageMediaMetadata'
    );
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('Content-Type', `multipart/related; boundary=${boundary}`);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          onProgress(pct);
        }
      };
    }

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          // Set reader permission so public customer gallery can load the photo preview
          await makeDriveFilePublicReader(accessToken, res.id);

          const directDownloadUrl = `https://lh3.googleusercontent.com/d/${res.id}`;
          const webPreviewUrl = `https://drive.google.com/thumbnail?id=${res.id}&sz=w1600`;
          const thumbUrl = `https://drive.google.com/thumbnail?id=${res.id}&sz=w600`;

          const parsedWidth = res.imageMediaMetadata?.width ? parseInt(res.imageMediaMetadata.width, 10) : undefined;
          const parsedHeight = res.imageMediaMetadata?.height ? parseInt(res.imageMediaMetadata.height, 10) : undefined;

          resolve({
            id: res.id,
            name: res.name || file.name,
            mimeType: res.mimeType || file.type,
            size: parseInt(res.size || file.size.toString(), 10),
            width: parsedWidth,
            height: parsedHeight,
            webViewLink: res.webViewLink || `https://drive.google.com/file/d/${res.id}/view`,
            webContentLink: res.webContentLink,
            thumbnailUrl: thumbUrl,
            previewUrl: webPreviewUrl,
            downloadUrl: directDownloadUrl,
          });
        } catch (err: any) {
          reject(new Error('Gagal memproses respon dari Google Drive.'));
        }
      } else {
        if (xhr.status === 401) {
          reject(new Error('AUTH_EXPIRED: Sesi Google Drive kedaluwarsa.'));
        } else {
          reject(new Error(`Gagal mengunggah ke Google Drive (${xhr.statusText || xhr.status})`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Terjadi kesalahan jaringan saat mengunggah foto ke Google Drive.'));
    };

    xhr.send(combinedBuffer);
  });
}

/**
 * Fetches real file metadata (size, imageMediaMetadata) from Google Drive
 */
export async function getDriveFileMetadata(
  accessToken: string,
  fileId: string
): Promise<{ size?: number; width?: number; height?: number } | null> {
  if (!accessToken || !fileId) return null;
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,size,imageMediaMetadata`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      size: data.size ? parseInt(data.size, 10) : undefined,
      width: data.imageMediaMetadata?.width ? parseInt(data.imageMediaMetadata.width, 10) : undefined,
      height: data.imageMediaMetadata?.height ? parseInt(data.imageMediaMetadata.height, 10) : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Gets real Google Drive storage quota
 */
export async function getDriveStorageQuota(accessToken: string): Promise<DriveStorageQuota> {
  const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota,user', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('AUTH_EXPIRED: Sesi Google Drive telah kedaluwarsa.');
    }
    throw new Error('Gagal mengambil informasi kapasitas Google Drive.');
  }

  const data = await res.json();
  const q = data.storageQuota || {};
  return {
    limitBytes: parseInt(q.limit || '16106127360', 10), // 15 GB default if unlimited
    usageBytes: parseInt(q.usage || '0', 10),
    usageInDriveBytes: parseInt(q.usageInDrive || '0', 10),
    usageInDriveTrashBytes: parseInt(q.usageInDriveTrash || '0', 10),
    userEmail: data.user?.emailAddress || '',
    userName: data.user?.displayName || '',
    lastSyncedAt: new Date().toISOString(),
  };
}

/**
 * Permanently deletes or trashes a file on Google Drive
 */
export async function deleteDriveFile(accessToken: string, fileId: string): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok && res.status !== 404) {
    // If not found, it's already deleted
    if (res.status === 401) {
      throw new Error('AUTH_EXPIRED: Sesi Google Drive telah kedaluwarsa.');
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gagal menghapus file di Google Drive.');
  }
}

/**
 * Moves a file in Google Drive from its current parent folder(s) to a new destination folder.
 * True Google Drive MOVE operation (addParents & removeParents).
 */
export async function moveDriveFile(
  accessToken: string,
  fileId: string,
  destinationFolderId: string,
  sourceFolderId?: string
): Promise<void> {
  let removeParents = sourceFolderId;
  if (!removeParents) {
    // Query current parents
    try {
      const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (metaRes.ok) {
        const meta = await metaRes.json();
        if (meta.parents && Array.isArray(meta.parents) && meta.parents.length > 0) {
          removeParents = meta.parents.join(',');
        }
      }
    } catch {
      // ignore
    }
  }

  let url = `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${encodeURIComponent(
    destinationFolderId
  )}`;
  if (removeParents) {
    url += `&removeParents=${encodeURIComponent(removeParents)}`;
  }

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('AUTH_EXPIRED: Sesi Google Drive kedaluwarsa.');
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gagal memindahkan file di Google Drive.');
  }
}

/**
 * Renames a folder or file in Google Drive
 */
export async function renameDriveFolder(
  accessToken: string,
  folderId: string,
  newName: string
): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: newName }),
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('AUTH_EXPIRED: Sesi Google Drive kedaluwarsa.');
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gagal mengubah nama folder di Google Drive.');
  }
}

/**
 * Creates a physical folder inside an album's Drive folder
 */
export async function createFolderInAlbumDrive(
  accessToken: string,
  albumDriveFolderId: string,
  folderName: string
): Promise<DriveFileMetadata> {
  const folder = await createDriveFolder(accessToken, folderName, albumDriveFolderId);
  try {
    await makeDriveFilePublicReader(accessToken, folder.id);
  } catch {
    // ignore
  }
  return folder;
}
