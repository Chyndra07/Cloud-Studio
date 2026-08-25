import { Album, Photo, StudioProfile, UserAccount, StudioTenantRecord } from '../types';
import { deleteDriveFile } from './googleDrive';
import { getStoredUserToken } from './googleAuth';

// Backend API publik. GitHub Pages tidak memiliki endpoint /api sendiri,
// jadi request server harus diarahkan ke deployment Cloud Run aplikasi.
const PUBLIC_API_ORIGIN = 'https://ais-pre-eroa24qfq6d4z76ps275od-153899979881.asia-southeast1.run.app';

const apiUrl = (path: string): string => {
  if (!path.startsWith('/')) path = `/${path}`;
  return `${PUBLIC_API_ORIGIN}${path}`;
};

const STORAGE_PREFIX = 'galerifotoqr_db_';

export const DEFAULT_STUDIO_PROFILE: StudioProfile = {
  studioName: '',
  tagline: '',
  whatsappNumber: '',
  instagram: '',
  website: '',
  address: '',
  accentColor: '#2563eb', // Blue
  watermarkEnabled: false,
  watermarkText: '',
  watermarkPosition: 'bottom-right',
  galleryFooterText: '',
  welcomeMessage: '',
  allowClientDownload: true,
  allowBatchZipDownload: true,
};

/**
 * Initialize storage cleanly.
 * Removes obsolete demo data and ensures empty initial state.
 */
export function initializeStorage() {
  try {
    const legacyKeys = [
      `${STORAGE_PREFIX}initialized`,
      `${STORAGE_PREFIX}albums_studio_lumina_demo`,
      `${STORAGE_PREFIX}photos_studio_lumina_demo`,
      `${STORAGE_PREFIX}profile_studio_lumina_demo`,
      `${STORAGE_PREFIX}albums_studio_kencana_demo`,
      `${STORAGE_PREFIX}photos_studio_kencana_demo`,
      `${STORAGE_PREFIX}profile_studio_kencana_demo`,
    ];
    for (const key of legacyKeys) {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
      }
    }
  } catch (err) {
    console.error('Storage cleanup failed:', err);
  }

  // Fast background sync of active tenant albums to server
  syncAllTenantsToServer().catch(() => {});
}

// ---------------- ALBUM OPERATIONS (STRICT OWNER ISOLATION) ----------------

export function getAlbumsForOwner(ownerId: string): Album[] {
  if (!ownerId) return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}albums_${ownerId}`);
    const albums: Album[] = raw ? JSON.parse(raw) : [];
    // Strict query validation: ownerId === authenticatedUserId
    return albums.filter((a) => a.ownerId === ownerId && !a.isDeleted);
  } catch {
    return [];
  }
}

export function getTrashForOwner(ownerId: string): { albums: Album[]; photos: Photo[] } {
  if (!ownerId) return { albums: [], photos: [] };
  try {
    const rawAlbums = localStorage.getItem(`${STORAGE_PREFIX}albums_${ownerId}`);
    const allAlbums: Album[] = rawAlbums ? JSON.parse(rawAlbums) : [];
    const trashAlbums = allAlbums.filter((a) => a.ownerId === ownerId && a.isDeleted);

    const rawPhotos = localStorage.getItem(`${STORAGE_PREFIX}photos_${ownerId}`);
    const allPhotos: Photo[] = rawPhotos ? JSON.parse(rawPhotos) : [];
    const trashPhotos = allPhotos.filter((p) => p.ownerId === ownerId && p.isDeleted);

    return { albums: trashAlbums, photos: trashPhotos };
  } catch {
    return { albums: [], photos: [] };
  }
}

export function saveAlbumsForOwner(ownerId: string, albums: Album[]) {
  if (!ownerId) return;
  localStorage.setItem(`${STORAGE_PREFIX}albums_${ownerId}`, JSON.stringify(albums));
  // Sync to global public registry for QR codes
  updatePublicGalleryRegistry();
}

export function createAlbum(
  ownerId: string,
  data: Partial<Album>
): Album {
  const randomSlug = 'GFQ-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const newAlbum: Album = {
    customerName: data.customerName || 'Pelanggan',
    eventName: data.eventName || 'Dokumentasi Acara',
    eventDate: data.eventDate || new Date().toISOString().split('T')[0],
    isPasswordProtected: Boolean(data.isPasswordProtected || data.pinEnabled),
    displayQuality: data.displayQuality || 'hd',
    ...data,
    id: 'alb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    galleryId: randomSlug,
    ownerId: ownerId,
    photosCount: 0,
    viewsCount: 0,
    downloadsCount: 0,
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const raw = localStorage.getItem(`${STORAGE_PREFIX}albums_${ownerId}`);
  const current: Album[] = raw ? JSON.parse(raw) : [];
  const updated = [newAlbum, ...current];
  saveAlbumsForOwner(ownerId, updated);

  // Immediately persist public gallery record to server & registry
  try {
    const studio = getStudioProfile(ownerId);
    savePublicGalleryRecord(newAlbum, [], studio).catch((err) => {
      console.warn('[Create Album] Initial server sync error:', err);
    });
  } catch (err) {
    console.warn('[Create Album] Profile lookup error:', err);
  }

  return newAlbum;
}

export function updateAlbum(ownerId: string, albumId: string, updates: Partial<Album>): Album {
  const raw = localStorage.getItem(`${STORAGE_PREFIX}albums_${ownerId}`);
  const current: Album[] = raw ? JSON.parse(raw) : [];
  const updated = current.map((a) => (a.id === albumId && a.ownerId === ownerId ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a));
  saveAlbumsForOwner(ownerId, updated);
  const targetAlbum = updated.find((a) => a.id === albumId)!;
  if (targetAlbum) {
    try {
      const photos = getPhotosForAlbum(ownerId, albumId);
      const studio = getStudioProfile(ownerId);
      savePublicGalleryRecord(targetAlbum, photos, studio).catch(() => {});
    } catch {}
  }
  return targetAlbum;
}

export function moveAlbumToTrash(ownerId: string, albumId: string) {
  if (!ownerId || !albumId) return;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}albums_${ownerId}`);
    const albums: Album[] = raw ? JSON.parse(raw) : [];
    let targetAlbum: Album | undefined;
    const updated = albums.map((a) => {
      if (a.id === albumId && a.ownerId === ownerId) {
        const trashed = { ...a, isDeleted: true, deletedAt: new Date().toISOString() };
        targetAlbum = trashed;
        return trashed;
      }
      return a;
    });
    localStorage.setItem(`${STORAGE_PREFIX}albums_${ownerId}`, JSON.stringify(updated));
    updatePublicGalleryRegistry();

    if (targetAlbum) {
      const studio = getStudioProfile(ownerId);
      syncPublicGalleryToServer(targetAlbum, [], studio).catch(() => {});
    }
  } catch (err) {
    console.error('[moveAlbumToTrash] Error:', err);
    throw err;
  }
}

export function restoreAlbumFromTrash(ownerId: string, albumId: string) {
  if (!ownerId) return;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}albums_${ownerId}`);
    const albums: Album[] = raw ? JSON.parse(raw) : [];
    let targetAlbum: Album | undefined;
    const updated = albums.map((a) => {
      if (a.id === albumId && a.ownerId === ownerId) {
        const restored = { ...a, isDeleted: false, deletedAt: undefined };
        targetAlbum = restored;
        return restored;
      }
      return a;
    });
    localStorage.setItem(`${STORAGE_PREFIX}albums_${ownerId}`, JSON.stringify(updated));
    updatePublicGalleryRegistry();

    if (targetAlbum) {
      const photos = getPhotosForAlbum(ownerId, albumId);
      const studio = getStudioProfile(ownerId);
      syncPublicGalleryToServer(targetAlbum, photos, studio).catch(() => {});
    }
  } catch (err) {
    console.error(err);
  }
}

export async function permanentlyDeleteAlbum(
  ownerId: string,
  albumId: string,
  accessToken?: string
): Promise<{ success: boolean; error?: string }> {
  if (!ownerId || !albumId) return { success: false, error: 'ID tidak valid.' };
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}albums_${ownerId}`);
    const albums: Album[] = raw ? JSON.parse(raw) : [];
    const targetAlbum = albums.find((a) => a.id === albumId && a.ownerId === ownerId);

    const rawPhotos = localStorage.getItem(`${STORAGE_PREFIX}photos_${ownerId}`);
    const photos: Photo[] = rawPhotos ? JSON.parse(rawPhotos) : [];
    const albumPhotos = photos.filter((p) => p.albumId === albumId && p.ownerId === ownerId);

    // 1. Google Drive Deletion if connected
    const effectiveToken = accessToken || getStoredUserToken(ownerId);
    if (effectiveToken) {
      if (targetAlbum?.driveFolderId) {
        try {
          await deleteDriveFile(effectiveToken, targetAlbum.driveFolderId);
        } catch (driveErr) {
          console.warn('[permanentlyDeleteAlbum] Drive folder delete warning:', driveErr);
        }
      }
      for (const p of albumPhotos) {
        if (p.driveFileId && p.driveFileId !== targetAlbum?.driveFolderId) {
          try {
            await deleteDriveFile(effectiveToken, p.driveFileId);
          } catch (pErr) {
            console.warn('[permanentlyDeleteAlbum] Drive photo file delete warning:', pErr);
          }
        }
      }
    }

    // 2. Remove album & its photos from localStorage
    const updated = albums.filter((a) => !(a.id === albumId && a.ownerId === ownerId));
    localStorage.setItem(`${STORAGE_PREFIX}albums_${ownerId}`, JSON.stringify(updated));

    const updatedPhotos = photos.filter((p) => !(p.albumId === albumId && p.ownerId === ownerId));
    localStorage.setItem(`${STORAGE_PREFIX}photos_${ownerId}`, JSON.stringify(updatedPhotos));

    updatePublicGalleryRegistry();

    // 3. Purge from backend server database
    const gId = targetAlbum?.galleryId || albumId;
    if (gId) {
      try {
        await fetch(`/api/public/gallery/${encodeURIComponent(gId)}?ownerId=${encodeURIComponent(ownerId)}`, {
          method: 'DELETE',
        });
      } catch (srvErr) {
        console.warn('[permanentlyDeleteAlbum] Server deletion warning:', srvErr);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('[permanentlyDeleteAlbum] Error:', err);
    return { success: false, error: err.message || 'Gagal menghapus album secara permanen.' };
  }
}

// ---------------- PHOTO OPERATIONS (STRICT OWNER ISOLATION) ----------------

export function getPhotosForAlbum(ownerId: string, albumId: string): Photo[] {
  if (!ownerId) return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}photos_${ownerId}`);
    const photos: Photo[] = raw ? JSON.parse(raw) : [];
    return photos.filter((p) => p.ownerId === ownerId && p.albumId === albumId && !p.isDeleted);
  } catch {
    return [];
  }
}

export function getAllPhotosForOwner(ownerId: string): Photo[] {
  if (!ownerId) return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}photos_${ownerId}`);
    const photos: Photo[] = raw ? JSON.parse(raw) : [];
    return photos.filter((p) => p.ownerId === ownerId && !p.isDeleted);
  } catch {
    return [];
  }
}

export function savePhotosForOwner(ownerId: string, photos: Photo[]) {
  if (!ownerId) return;
  localStorage.setItem(`${STORAGE_PREFIX}photos_${ownerId}`, JSON.stringify(photos));
  updatePublicGalleryRegistry();
}

export function addPhotosToAlbum(ownerId: string, albumId: string, newPhotos: Photo[]) {
  if (!ownerId) return;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}photos_${ownerId}`);
    const existing: Photo[] = raw ? JSON.parse(raw) : [];
    const combined = [...newPhotos, ...existing];
    localStorage.setItem(`${STORAGE_PREFIX}photos_${ownerId}`, JSON.stringify(combined));

    // Update album count and cover photo if missing
    const rawAlbums = localStorage.getItem(`${STORAGE_PREFIX}albums_${ownerId}`);
    const albums: Album[] = rawAlbums ? JSON.parse(rawAlbums) : [];
    let targetAlbum: Album | undefined;
    const updatedAlbums = albums.map((alb) => {
      if (alb.id === albumId && alb.ownerId === ownerId) {
        const totalAlbumPhotos = combined.filter((p) => p.albumId === albumId && !p.isDeleted).length;
        const updated = {
          ...alb,
          photosCount: totalAlbumPhotos,
          coverPhotoUrl: alb.coverPhotoUrl || (newPhotos[0] ? newPhotos[0].thumbnailUrl : undefined),
          updatedAt: new Date().toISOString(),
        };
        targetAlbum = updated;
        return updated;
      }
      return alb;
    });
    localStorage.setItem(`${STORAGE_PREFIX}albums_${ownerId}`, JSON.stringify(updatedAlbums));

    updatePublicGalleryRegistry();

    // Immediately push to backend database
    if (targetAlbum) {
      const studio = getStudioProfile(ownerId);
      const activeAlbumPhotos = combined.filter((p) => p.albumId === albumId && !p.isDeleted);
      syncPublicGalleryToServer(targetAlbum, activeAlbumPhotos, studio).catch((err) => {
        console.warn('[Add Photos] Server sync warning:', err);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

export function movePhotoToTrash(ownerId: string, photoId: string) {
  if (!ownerId) return;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}photos_${ownerId}`);
    const photos: Photo[] = raw ? JSON.parse(raw) : [];
    const photo = photos.find((p) => p.id === photoId && p.ownerId === ownerId);
    if (!photo) return;

    const updated = photos.map((p) =>
      p.id === photoId && p.ownerId === ownerId ? { ...p, isDeleted: true, deletedAt: new Date().toISOString() } : p
    );
    localStorage.setItem(`${STORAGE_PREFIX}photos_${ownerId}`, JSON.stringify(updated));

    // Update album photo count
    const rawAlbums = localStorage.getItem(`${STORAGE_PREFIX}albums_${ownerId}`);
    const albums: Album[] = rawAlbums ? JSON.parse(rawAlbums) : [];
    let targetAlbum: Album | undefined;
    const updatedAlbums = albums.map((alb) => {
      if (alb.id === photo.albumId && alb.ownerId === ownerId) {
        const remainingCount = updated.filter((p) => p.albumId === alb.id && !p.isDeleted).length;
        const updatedAlb = { ...alb, photosCount: remainingCount, updatedAt: new Date().toISOString() };
        targetAlbum = updatedAlb;
        return updatedAlb;
      }
      return alb;
    });
    localStorage.setItem(`${STORAGE_PREFIX}albums_${ownerId}`, JSON.stringify(updatedAlbums));

    updatePublicGalleryRegistry();

    if (targetAlbum) {
      const studio = getStudioProfile(ownerId);
      const activeAlbumPhotos = updated.filter((p) => p.albumId === photo.albumId && !p.isDeleted);
      syncPublicGalleryToServer(targetAlbum, activeAlbumPhotos, studio).catch(() => {});
    }
  } catch (err) {
    console.error(err);
  }
}

export function restorePhotoFromTrash(ownerId: string, photoId: string) {
  if (!ownerId) return;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}photos_${ownerId}`);
    const photos: Photo[] = raw ? JSON.parse(raw) : [];
    const photo = photos.find((p) => p.id === photoId && p.ownerId === ownerId);
    if (!photo) return;

    const updated = photos.map((p) =>
      p.id === photoId && p.ownerId === ownerId ? { ...p, isDeleted: false, deletedAt: undefined } : p
    );
    localStorage.setItem(`${STORAGE_PREFIX}photos_${ownerId}`, JSON.stringify(updated));

    const albumPhotos = updated.filter((p) => p.albumId === photo.albumId && !p.isDeleted);
    updateAlbum(ownerId, photo.albumId, { photosCount: albumPhotos.length });
    updatePublicGalleryRegistry();
  } catch (err) {
    console.error(err);
  }
}

export async function permanentlyDeletePhoto(
  ownerId: string,
  photoId: string,
  accessToken?: string
): Promise<{ success: boolean; error?: string }> {
  if (!ownerId || !photoId) return { success: false, error: 'ID tidak valid.' };
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}photos_${ownerId}`);
    const photos: Photo[] = raw ? JSON.parse(raw) : [];
    const targetPhoto = photos.find((p) => p.id === photoId && p.ownerId === ownerId);

    // 1. Google Drive Deletion if connected
    const effectiveToken = accessToken || getStoredUserToken(ownerId);
    if (effectiveToken && targetPhoto?.driveFileId) {
      try {
        await deleteDriveFile(effectiveToken, targetPhoto.driveFileId);
      } catch (driveErr) {
        console.warn('[permanentlyDeletePhoto] Drive photo delete warning:', driveErr);
      }
    }

    // 2. Remove photo from localStorage
    const updatedPhotos = photos.filter((p) => !(p.id === photoId && p.ownerId === ownerId));
    localStorage.setItem(`${STORAGE_PREFIX}photos_${ownerId}`, JSON.stringify(updatedPhotos));

    // 3. Update album photo count if associated
    if (targetPhoto?.albumId) {
      const rawAlbums = localStorage.getItem(`${STORAGE_PREFIX}albums_${ownerId}`);
      const albums: Album[] = rawAlbums ? JSON.parse(rawAlbums) : [];
      let targetAlbum: Album | undefined;
      const updatedAlbums = albums.map((alb) => {
        if (alb.id === targetPhoto.albumId && alb.ownerId === ownerId) {
          const remainingCount = updatedPhotos.filter((p) => p.albumId === alb.id && !p.isDeleted).length;
          const updatedAlb = { ...alb, photosCount: remainingCount, updatedAt: new Date().toISOString() };
          targetAlbum = updatedAlb;
          return updatedAlb;
        }
        return alb;
      });
      localStorage.setItem(`${STORAGE_PREFIX}albums_${ownerId}`, JSON.stringify(updatedAlbums));
      if (targetAlbum) {
        const studio = getStudioProfile(ownerId);
        const activeAlbumPhotos = updatedPhotos.filter((p) => p.albumId === targetPhoto.albumId && !p.isDeleted);
        syncPublicGalleryToServer(targetAlbum, activeAlbumPhotos, studio).catch(() => {});
      }
    }

    updatePublicGalleryRegistry();
    return { success: true };
  } catch (err: any) {
    console.error('[permanentlyDeletePhoto] Error:', err);
    return { success: false, error: err.message || 'Gagal menghapus foto secara permanen.' };
  }
}

/**
 * Moves photos to a target folder (or Foto Langsung) and updates metadata
 */
export function movePhotosToFolder(
  ownerId: string,
  albumId: string,
  photoIds: string[],
  targetFolderName: string,
  targetSubfolder: string = '',
  targetFolderPath: string = '',
  targetDriveFolderId?: string
): Photo[] {
  if (!ownerId || photoIds.length === 0) return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}photos_${ownerId}`);
    const photos: Photo[] = raw ? JSON.parse(raw) : [];
    const idSet = new Set(photoIds);

    const isDirect = !targetFolderName.trim();
    const effectiveFolderName = isDirect ? '' : targetFolderName.trim();
    const effectiveSubfolder = isDirect ? '' : targetSubfolder.trim();
    const effectiveFolderPath = isDirect
      ? ''
      : targetFolderPath.trim() || (effectiveSubfolder ? `${effectiveFolderName}/${effectiveSubfolder}` : effectiveFolderName);

    const updated = photos.map((p) => {
      if (p.albumId === albumId && p.ownerId === ownerId && idSet.has(p.id)) {
        return {
          ...p,
          folderName: effectiveFolderName,
          subfolder: effectiveSubfolder,
          folderPath: effectiveFolderPath,
          driveFolderId: targetDriveFolderId || (isDirect ? undefined : p.driveFolderId),
        };
      }
      return p;
    });

    localStorage.setItem(`${STORAGE_PREFIX}photos_${ownerId}`, JSON.stringify(updated));
    updatePublicGalleryRegistry();

    // Ensure folder is in album's customFolders list if not direct
    if (effectiveFolderName) {
      addFolderToAlbum(ownerId, albumId, effectiveFolderName);
    }

    // Sync to backend
    const rawAlbums = localStorage.getItem(`${STORAGE_PREFIX}albums_${ownerId}`);
    const albums: Album[] = rawAlbums ? JSON.parse(rawAlbums) : [];
    const targetAlbum = albums.find((a) => a.id === albumId && a.ownerId === ownerId);
    if (targetAlbum) {
      const studio = getStudioProfile(ownerId);
      const activeAlbumPhotos = updated.filter((p) => p.albumId === albumId && !p.isDeleted);
      syncPublicGalleryToServer(targetAlbum, activeAlbumPhotos, studio).catch(() => {});
    }

    return updated.filter((p) => p.albumId === albumId && !p.isDeleted);
  } catch (err) {
    console.error(err);
    return [];
  }
}

/**
 * Adds an empty or new folder to an album's customFolders list so it appears in structure even with 0 photos
 */
export function addFolderToAlbum(ownerId: string, albumId: string, folderName: string): Album | null {
  if (!ownerId || !albumId || !folderName.trim()) return null;
  const cleanName = folderName.trim();
  try {
    const rawAlbums = localStorage.getItem(`${STORAGE_PREFIX}albums_${ownerId}`);
    const albums: Album[] = rawAlbums ? JSON.parse(rawAlbums) : [];
    let updatedAlbum: Album | null = null;

    const updated = albums.map((alb) => {
      if (alb.id === albumId && alb.ownerId === ownerId) {
        const existingFolders = alb.customFolders || [];
        if (!existingFolders.some((f) => f.toLowerCase() === cleanName.toLowerCase())) {
          updatedAlbum = {
            ...alb,
            customFolders: [...existingFolders, cleanName],
            updatedAt: new Date().toISOString(),
          };
          return updatedAlbum;
        }
        updatedAlbum = alb;
        return alb;
      }
      return alb;
    });

    localStorage.setItem(`${STORAGE_PREFIX}albums_${ownerId}`, JSON.stringify(updated));
    updatePublicGalleryRegistry();

    if (updatedAlbum) {
      const studio = getStudioProfile(ownerId);
      const photos = getPhotosForAlbum(ownerId, albumId);
      syncPublicGalleryToServer(updatedAlbum, photos, studio).catch(() => {});
    }

    return updatedAlbum;
  } catch (err) {
    console.error(err);
    return null;
  }
}

/**
 * Renames an existing folder across all photos and album customFolders
 */
export function renameFolderInAlbum(
  ownerId: string,
  albumId: string,
  oldFolderName: string,
  newFolderName: string
): { album: Album | null; photos: Photo[] } {
  if (!ownerId || !albumId || !oldFolderName.trim() || !newFolderName.trim()) {
    return { album: null, photos: [] };
  }
  const oldName = oldFolderName.trim();
  const newName = newFolderName.trim();

  try {
    // 1. Update photos
    const rawPhotos = localStorage.getItem(`${STORAGE_PREFIX}photos_${ownerId}`);
    const photos: Photo[] = rawPhotos ? JSON.parse(rawPhotos) : [];
    const updatedPhotos = photos.map((p) => {
      if (p.albumId === albumId && p.ownerId === ownerId && p.folderName === oldName) {
        const updatedPath = p.folderPath ? p.folderPath.replace(new RegExp(`^${oldName}`), newName) : newName;
        return {
          ...p,
          folderName: newName,
          folderPath: updatedPath,
        };
      }
      return p;
    });
    localStorage.setItem(`${STORAGE_PREFIX}photos_${ownerId}`, JSON.stringify(updatedPhotos));

    // 2. Update album customFolders
    const rawAlbums = localStorage.getItem(`${STORAGE_PREFIX}albums_${ownerId}`);
    const albums: Album[] = rawAlbums ? JSON.parse(rawAlbums) : [];
    let updatedAlbum: Album | null = null;
    const updatedAlbums = albums.map((alb) => {
      if (alb.id === albumId && alb.ownerId === ownerId) {
        const custom = (alb.customFolders || []).map((f) => (f.toLowerCase() === oldName.toLowerCase() ? newName : f));
        if (!custom.some((f) => f.toLowerCase() === newName.toLowerCase())) {
          custom.push(newName);
        }
        updatedAlbum = {
          ...alb,
          customFolders: custom,
          updatedAt: new Date().toISOString(),
        };
        return updatedAlbum;
      }
      return alb;
    });
    localStorage.setItem(`${STORAGE_PREFIX}albums_${ownerId}`, JSON.stringify(updatedAlbums));
    updatePublicGalleryRegistry();

    if (updatedAlbum) {
      const studio = getStudioProfile(ownerId);
      const activePhotos = updatedPhotos.filter((p) => p.albumId === albumId && !p.isDeleted);
      syncPublicGalleryToServer(updatedAlbum, activePhotos, studio).catch(() => {});
    }

    return {
      album: updatedAlbum,
      photos: updatedPhotos.filter((p) => p.albumId === albumId && !p.isDeleted),
    };
  } catch (err) {
    console.error(err);
    return { album: null, photos: [] };
  }
}

/**
 * Deletes a folder: photos inside are moved to Foto Langsung (Tanpa Folder) by default, or deleted if deletePhotos=true
 */
export function deleteFolderInAlbum(
  ownerId: string,
  albumId: string,
  folderName: string,
  deletePhotos: boolean = false
): { album: Album | null; photos: Photo[] } {
  if (!ownerId || !albumId || !folderName.trim()) {
    return { album: null, photos: [] };
  }
  const targetName = folderName.trim();

  try {
    const rawPhotos = localStorage.getItem(`${STORAGE_PREFIX}photos_${ownerId}`);
    const photos: Photo[] = rawPhotos ? JSON.parse(rawPhotos) : [];

    const updatedPhotos = photos.map((p) => {
      if (p.albumId === albumId && p.ownerId === ownerId && p.folderName === targetName) {
        if (deletePhotos) {
          return { ...p, isDeleted: true, deletedAt: new Date().toISOString() };
        } else {
          return { ...p, folderName: '', subfolder: '', folderPath: '', driveFolderId: undefined };
        }
      }
      return p;
    });
    localStorage.setItem(`${STORAGE_PREFIX}photos_${ownerId}`, JSON.stringify(updatedPhotos));

    const rawAlbums = localStorage.getItem(`${STORAGE_PREFIX}albums_${ownerId}`);
    const albums: Album[] = rawAlbums ? JSON.parse(rawAlbums) : [];
    let updatedAlbum: Album | null = null;
    const updatedAlbums = albums.map((alb) => {
      if (alb.id === albumId && alb.ownerId === ownerId) {
        const custom = (alb.customFolders || []).filter((f) => f.toLowerCase() !== targetName.toLowerCase());
        const remainingCount = updatedPhotos.filter((p) => p.albumId === albumId && !p.isDeleted).length;
        updatedAlbum = {
          ...alb,
          customFolders: custom,
          photosCount: remainingCount,
          updatedAt: new Date().toISOString(),
        };
        return updatedAlbum;
      }
      return alb;
    });
    localStorage.setItem(`${STORAGE_PREFIX}albums_${ownerId}`, JSON.stringify(updatedAlbums));
    updatePublicGalleryRegistry();

    if (updatedAlbum) {
      const studio = getStudioProfile(ownerId);
      const activePhotos = updatedPhotos.filter((p) => p.albumId === albumId && !p.isDeleted);
      syncPublicGalleryToServer(updatedAlbum, activePhotos, studio).catch(() => {});
    }

    return {
      album: updatedAlbum,
      photos: updatedPhotos.filter((p) => p.albumId === albumId && !p.isDeleted),
    };
  } catch (err) {
    console.error(err);
    return { album: null, photos: [] };
  }
}


export async function emptyTrash(
  ownerId: string,
  accessToken?: string
): Promise<{ success: boolean; deletedAlbumsCount: number; deletedPhotosCount: number; error?: string }> {
  if (!ownerId) {
    return { success: false, deletedAlbumsCount: 0, deletedPhotosCount: 0, error: 'User ID tidak valid.' };
  }
  try {
    const rawAlbums = localStorage.getItem(`${STORAGE_PREFIX}albums_${ownerId}`);
    const albums: Album[] = rawAlbums ? JSON.parse(rawAlbums) : [];
    const trashedAlbums = albums.filter((a) => a.isDeleted && a.ownerId === ownerId);
    const trashedAlbumIds = new Set(trashedAlbums.map((a) => a.id));

    const rawPhotos = localStorage.getItem(`${STORAGE_PREFIX}photos_${ownerId}`);
    const photos: Photo[] = rawPhotos ? JSON.parse(rawPhotos) : [];
    // Either photo is marked isDeleted or belongs to an album that is trashed
    const trashedPhotos = photos.filter(
      (p) => p.ownerId === ownerId && (p.isDeleted || trashedAlbumIds.has(p.albumId))
    );

    const effectiveToken = accessToken || getStoredUserToken(ownerId);

    // 1. Delete Google Drive folders and files for trashed items if connected
    if (effectiveToken) {
      // Delete album folders on Drive
      for (const alb of trashedAlbums) {
        if (alb.driveFolderId) {
          try {
            await deleteDriveFile(effectiveToken, alb.driveFolderId);
          } catch (driveErr) {
            console.warn(`[emptyTrash] Drive folder delete notice for album "${alb.eventName}":`, driveErr);
          }
        }
      }

      // Delete standalone trashed photo files on Drive (if not already deleted with folder)
      for (const p of trashedPhotos) {
        if (p.driveFileId) {
          try {
            await deleteDriveFile(effectiveToken, p.driveFileId);
          } catch (pErr) {
            console.warn(`[emptyTrash] Drive photo delete notice for photo "${p.filename}":`, pErr);
          }
        }
      }
    }

    // 2. Remove all trashed albums and photos from localStorage
    const updatedAlbums = albums.filter((a) => !a.isDeleted && a.ownerId === ownerId);
    localStorage.setItem(`${STORAGE_PREFIX}albums_${ownerId}`, JSON.stringify(updatedAlbums));

    const updatedPhotos = photos.filter(
      (p) => !p.isDeleted && !trashedAlbumIds.has(p.albumId) && p.ownerId === ownerId
    );
    localStorage.setItem(`${STORAGE_PREFIX}photos_${ownerId}`, JSON.stringify(updatedPhotos));

    updatePublicGalleryRegistry();

    // 3. Purge from backend server database
    try {
      await fetch('/api/public/trash/empty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId,
          galleryIds: trashedAlbums.map((a) => a.galleryId),
          albumIds: trashedAlbums.map((a) => a.id),
        }),
      });
    } catch (srvErr) {
      console.warn('[emptyTrash] Server database cleanup notice:', srvErr);
    }

    return {
      success: true,
      deletedAlbumsCount: trashedAlbums.length,
      deletedPhotosCount: trashedPhotos.length,
    };
  } catch (err: any) {
    console.error('[emptyTrash] Error:', err);
    throw err;
  }
}

// ---------------- STUDIO BRANDING / PROFILE ----------------

export function getStudioProfile(userId: string): StudioProfile {
  if (!userId) return { ...DEFAULT_STUDIO_PROFILE };
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}profile_${userId}`);
    return raw ? { ...DEFAULT_STUDIO_PROFILE, ...JSON.parse(raw) } : { ...DEFAULT_STUDIO_PROFILE };
  } catch {
    return { ...DEFAULT_STUDIO_PROFILE };
  }
}

export function saveStudioProfile(userId: string, profile: StudioProfile) {
  if (!userId) return;
  const updatedProfile: StudioProfile = {
    ...profile,
    studioLogoUrl: profile.studioLogoUrl || profile.logoUrl,
    logoUrl: profile.logoUrl || profile.studioLogoUrl,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(`${STORAGE_PREFIX}profile_${userId}`, JSON.stringify(updatedProfile));
  updatePublicGalleryRegistry();

  // Asynchronously synchronize profile to backend server
  fetch('/api/studio/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerId: userId, profile: updatedProfile }),
  }).catch((err) => {
    console.warn('[StudioProfile] Server background sync warning:', err);
  });
}

/**
 * Fetches remote persistent studio profile from server and updates local cache
 */
export async function fetchRemoteStudioProfile(userId: string): Promise<StudioProfile | null> {
  if (!userId) return null;
  try {
    const res = await fetch(`/api/studio/profile/${encodeURIComponent(userId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && data.profile) {
      const merged: StudioProfile = {
        ...DEFAULT_STUDIO_PROFILE,
        ...data.profile,
        studioLogoUrl: data.profile.studioLogoUrl || data.profile.logoUrl,
        logoUrl: data.profile.logoUrl || data.profile.studioLogoUrl,
      };
      localStorage.setItem(`${STORAGE_PREFIX}profile_${userId}`, JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    console.warn('[StudioProfile] Remote fetch warning:', err);
  }
  return null;
}

/**
 * Uploads studio logo image to persistent storage (max 2MB, formats: PNG, JPG, WebP, SVG)
 */
export async function uploadStudioLogo(
  ownerId: string, 
  file: File
): Promise<{ success: boolean; logoUrl?: string; error?: string }> {
  if (!ownerId) {
    return { success: false, error: 'User ID tidak valid.' };
  }
  if (!file) {
    return { success: false, error: 'File logo tidak ditemukan.' };
  }

  // 1. Validation: Max 2MB
  const MAX_SIZE = 2 * 1024 * 1024; // 2MB
  if (file.size > MAX_SIZE) {
    return { 
      success: false, 
      error: `Ukuran file logo terlalu besar (${(file.size / (1024 * 1024)).toFixed(2)} MB). Maksimal ukuran file adalah 2 MB.` 
    };
  }

  // 2. Validation: Mime types
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
  if (!allowedTypes.includes(file.type.toLowerCase())) {
    return { 
      success: false, 
      error: 'Format file tidak didukung. Harap pilih gambar dengan format PNG, JPG/JPEG, WebP, atau SVG.' 
    };
  }

  // 3. Convert to base64
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        const res = await fetch(apiUrl('/api/studio/logo'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ownerId,
            logoBase64: base64Data,
            fileName: file.name,
            mimeType: file.type,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          resolve({ success: false, error: data.error || 'Gagal mengunggah logo ke server.' });
          return;
        }

        // Update local studio profile with new logo
        const currentProfile = getStudioProfile(ownerId);
        const updatedProfile: StudioProfile = {
          ...currentProfile,
          studioLogoUrl: data.logoUrl,
          logoUrl: data.logoUrl,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(`${STORAGE_PREFIX}profile_${ownerId}`, JSON.stringify(updatedProfile));
        updatePublicGalleryRegistry();

        resolve({ success: true, logoUrl: data.logoUrl });
      } catch (err: any) {
        resolve({ success: false, error: err.message || 'Terjadi kesalahan jaringan saat mengunggah logo.' });
      }
    };
    reader.onerror = () => {
      resolve({ success: false, error: 'Gagal membaca file gambar.' });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Removes studio logo from server and local profile
 */
export async function deleteStudioLogo(ownerId: string): Promise<{ success: boolean; error?: string }> {
  if (!ownerId) return { success: false, error: 'User ID tidak valid.' };
  try {
    const res = await fetch(apiUrl(`/api/studio/logo/${encodeURIComponent(ownerId)}`), {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Gagal menghapus logo di server.' };
    }

    const currentProfile = getStudioProfile(ownerId);
    const updatedProfile: StudioProfile = {
      ...currentProfile,
      studioLogoUrl: undefined,
      logoUrl: undefined,
      studioLogoPath: undefined,
      updatedAt: new Date().toISOString(),
    };
    delete updatedProfile.studioLogoUrl;
    delete updatedProfile.logoUrl;
    delete updatedProfile.studioLogoPath;

    localStorage.setItem(`${STORAGE_PREFIX}profile_${ownerId}`, JSON.stringify(updatedProfile));
    updatePublicGalleryRegistry();

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal menghapus logo.' };
  }
}

// ---------------- PUBLIC CUSTOMER GALLERY LOOKUP & SERVER SYNC ----------------

export interface PublicGalleryBundle {
  status?: 'ok' | 'expired' | 'disabled' | 'not_found' | 'error';
  album: Album;
  photos: Photo[];
  studio: StudioProfile;
  fromServer?: boolean;
}

export interface PublishVerificationResult {
  success: boolean;
  verified: boolean;
  galleryId: string;
  error?: string;
  record?: any;
}

/**
 * Creates/Updates the public gallery record on the server (Single Source of Truth)
 * and performs read-back verification against the server API.
 */
export async function syncPublicGalleryToServer(
  album: Album, 
  photos: Photo[], 
  studio: StudioProfile
): Promise<PublishVerificationResult> {
  if (!album || !(album.galleryId || album.id)) {
    return { success: false, verified: false, galleryId: '', error: 'Data album tidak valid.' };
  }

  const cleanGalleryId = (album.galleryId || album.id).trim().toUpperCase();

  // 1. Update local registry immediately
  try {
    const registryRaw = localStorage.getItem(`${STORAGE_PREFIX}public_registry`);
    const registry = registryRaw ? JSON.parse(registryRaw) : {};
    registry[cleanGalleryId] = {
      status: album.isDeleted ? 'disabled' : 'ok',
      album: { ...album, galleryId: cleanGalleryId },
      photos: photos.filter((p) => !p.isDeleted),
      studio,
    };
    localStorage.setItem(`${STORAGE_PREFIX}public_registry`, JSON.stringify(registry));
  } catch (err) {
    console.warn('[Storage] Local registry cache update warning:', err);
  }

  // 2. Persist to server backend database (Single Source of Truth)
  try {
    const payload = {
      album: {
        id: album.id,
        galleryId: cleanGalleryId,
        ownerId: album.ownerId,
        ownerUid: album.ownerId,
        eventName: album.eventName,
        albumName: album.eventName,
        customerName: album.customerName,
        clientName: album.customerName,
        eventDate: album.eventDate || new Date().toISOString().split('T')[0],
        description: album.description || '',
        coverPhotoUrl: album.coverPhotoUrl,
        pinEnabled: !!album.isPasswordProtected,
        isPasswordProtected: !!album.isPasswordProtected,
        pinHash: album.passwordHash,
        passwordHash: album.passwordHash,
        displayQuality: album.displayQuality || 'hd',
        expiresAt: album.expiresAt,
        isPublished: true,
        status: album.isDeleted ? 'disabled' : 'published',
        isDeleted: !!album.isDeleted,
        viewsCount: album.viewsCount || 0,
        downloadsCount: album.downloadsCount || 0,
        driveFolderId: album.driveFolderId,
        driveFolderUrl: album.driveFolderUrl,
        createdAt: album.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        publishedAt: album.publishedAt || new Date().toISOString(),
      },
      photos: photos.filter((p) => !p.isDeleted),
      studio,
    };

    const res = await fetch('/api/public/gallery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return { 
        success: false, 
        verified: false, 
        galleryId: cleanGalleryId, 
        error: errJson.error || `HTTP ${res.status}: Gagal menyimpan ke server database.` 
      };
    }

    // 3. READ-BACK VERIFICATION directly from the server GET endpoint
    const verifyRes = await fetch(`/api/public/gallery/${encodeURIComponent(cleanGalleryId)}`);
    if (verifyRes.ok) {
      const verifyData = await verifyRes.json();
      console.log(`[PUBLICATION VERIFIED] Server confirmed public gallery record for: ${cleanGalleryId}`, verifyData);
      return {
        success: true,
        verified: true,
        galleryId: cleanGalleryId,
        record: verifyData,
      };
    } else {
      console.warn(`[PUBLICATION READ-BACK FAILED] Write succeeded but read-back failed with HTTP ${verifyRes.status}`);
      return {
        success: true,
        verified: false,
        galleryId: cleanGalleryId,
        error: 'Record tersimpan namun belum dapat diverifikasi kembali dari server.',
      };
    }
  } catch (err: any) {
    console.error('[Sync] Could not sync gallery to server endpoint:', err);
    return {
      success: false,
      verified: false,
      galleryId: cleanGalleryId,
      error: err.message || 'Koneksi ke backend server gagal.',
    };
  }
}

/**
 * Backwards-compatible alias for saving public gallery record
 */
export async function savePublicGalleryRecord(album: Album, photos: Photo[], studio: StudioProfile): Promise<boolean> {
  const result = await syncPublicGalleryToServer(album, photos, studio);
  return result.success;
}

/**
 * Republishes / Repairs an existing album so it is guaranteed to have an active Public Gallery Record on the server.
 * Retains existing galleryId, syncs metadata, PIN, and photos with read-back verification.
 */
export async function republishAlbum(
  album: Album, 
  ownerId: string
): Promise<{ success: boolean; verified: boolean; error?: string; galleryId: string }> {
  try {
    if (!album) return { success: false, verified: false, error: 'Album tidak ditemukan.', galleryId: '' };
    
    const photos = getPhotosForAlbum(ownerId, album.id);
    const studio = getStudioProfile(ownerId);
    const normGalleryId = (album.galleryId || 'GFQ-' + Math.random().toString(36).substring(2, 8)).trim().toUpperCase();
    
    const updatedAlbum: Album = {
      ...album,
      galleryId: normGalleryId,
      photosCount: photos.length,
      updatedAt: new Date().toISOString(),
    };

    // Save locally
    updateAlbum(ownerId, album.id, { galleryId: normGalleryId, photosCount: photos.length });

    // Save & Publish to server with full read-back verification
    const result = await syncPublicGalleryToServer(updatedAlbum, photos, studio);
    
    return {
      success: result.success,
      verified: result.verified,
      error: result.error,
      galleryId: normGalleryId,
    };
  } catch (err: any) {
    console.error('[Republish Album Failed]:', err);
    return { 
      success: false, 
      verified: false, 
      error: err.message || 'Gagal mempublikasikan album.', 
      galleryId: album?.galleryId || '' 
    };
  }
}

export async function syncAllTenantsToServer(): Promise<void> {
  try {
    const keys = Object.keys(localStorage);
    const bundles: PublicGalleryBundle[] = [];

    for (const key of keys) {
      if (key.startsWith(`${STORAGE_PREFIX}albums_`)) {
        const ownerId = key.replace(`${STORAGE_PREFIX}albums_`, '');
        const albums: Album[] = JSON.parse(localStorage.getItem(key) || '[]');
        const profile = getStudioProfile(ownerId);
        const photosRaw = localStorage.getItem(`${STORAGE_PREFIX}photos_${ownerId}`);
        const photos: Photo[] = photosRaw ? JSON.parse(photosRaw) : [];

        for (const alb of albums) {
          const albPhotos = photos.filter((p) => p.albumId === alb.id && !p.isDeleted);
          bundles.push({
            album: alb,
            photos: albPhotos,
            studio: profile,
          });
        }
      }
    }

    if (bundles.length > 0) {
      await fetch('/api/public/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundles }),
      });
    }
  } catch (err) {
    console.warn('[Sync] Background sync to server failed:', err);
  }
}

export function updatePublicGalleryRegistry() {
  try {
    const keys = Object.keys(localStorage);
    const registry: Record<string, PublicGalleryBundle> = {};

    for (const key of keys) {
      if (key.startsWith(`${STORAGE_PREFIX}albums_`)) {
        const ownerId = key.replace(`${STORAGE_PREFIX}albums_`, '');
        const albums: Album[] = JSON.parse(localStorage.getItem(key) || '[]');
        const profile = getStudioProfile(ownerId);
        const photosRaw = localStorage.getItem(`${STORAGE_PREFIX}photos_${ownerId}`);
        const photos: Photo[] = photosRaw ? JSON.parse(photosRaw) : [];

        for (const alb of albums) {
          if (!alb.isDeleted) {
            const albPhotos = photos.filter((p) => p.albumId === alb.id && !p.isDeleted);
            const bundleItem: PublicGalleryBundle = {
              status: 'ok',
              album: alb,
              photos: albPhotos,
              studio: profile,
            };
            registry[alb.galleryId] = bundleItem;
            // Also sync to server in background
            syncPublicGalleryToServer(alb, albPhotos, profile).catch(() => {});
          }
        }
      }
    }

    localStorage.setItem(`${STORAGE_PREFIX}public_registry`, JSON.stringify(registry));
  } catch (err) {
    console.error('Error updating public gallery registry', err);
  }
}

/**
 * Direct check against the server database GET /api/public/gallery/:galleryId
 * Does NOT fallback to localStorage so verification is 100% genuine.
 */
export async function verifyServerRecord(galleryId: string): Promise<{
  exists: boolean;
  status: number;
  isPublished?: boolean;
  record?: any;
  error?: string;
}> {
  if (!galleryId) return { exists: false, status: 400, error: 'ID Galeri kosong.' };
  const cleanId = galleryId.trim().toUpperCase();

  try {
    const res = await fetch(`/api/public/gallery/${encodeURIComponent(cleanId)}`);
    if (res.ok) {
      const data = await res.json();
      return {
        exists: true,
        status: res.status,
        isPublished: data.isPublished !== false && data.status !== 'disabled',
        record: data,
      };
    }
    return {
      exists: false,
      status: res.status,
      error: res.status === 404 ? 'Record tidak ditemukan di database server.' : `Server error (${res.status})`,
    };
  } catch (err: any) {
    return {
      exists: false,
      status: 0,
      error: err.message || 'Koneksi server gagal.',
    };
  }
}

/**
 * Robust async public gallery lookup for customer gallery view
 */
export async function fetchPublicGalleryBySlug(galleryId: string): Promise<PublicGalleryBundle | null> {
  if (!galleryId) return null;
  const cleanId = galleryId.trim().toUpperCase();

  try {
    // 1. Primary: Fetch from server API (Single Source of Truth)
    const response = await fetch(`/api/public/gallery/${encodeURIComponent(cleanId)}`);
    
    if (response.ok) {
      const data = await response.json();
      return {
        status: data.status || 'ok',
        album: data.album,
        photos: data.photos || [],
        studio: data.studio,
        fromServer: true,
      };
    }

    if (response.status === 410) {
      const data = await response.json();
      return {
        status: 'disabled',
        album: data.album || ({} as any),
        photos: [],
        studio: data.studio || ({} as any),
        fromServer: true,
      };
    }
  } catch (netErr) {
    console.warn('[Public Gallery Lookup] Network request to server failed:', netErr);
  }

  // 2. Fallback / Auto-repair: If client has local copy (e.g. from studio device), auto-sync to server!
  const localBundle = getPublicGalleryBySlug(cleanId);
  if (localBundle) {
    // Attempt auto-repair sync to server in background
    syncPublicGalleryToServer(localBundle.album, localBundle.photos, localBundle.studio).catch(() => {});
    
    const isExpired = localBundle.album.expiresAt && new Date(localBundle.album.expiresAt) < new Date();
    return {
      status: localBundle.album.isDeleted ? 'disabled' : isExpired ? 'expired' : 'ok',
      album: localBundle.album,
      photos: isExpired ? [] : localBundle.photos,
      studio: localBundle.studio,
      fromServer: false,
    };
  }

  return null;
}

export function getPublicGalleryBySlug(galleryId: string): PublicGalleryBundle | null {
  if (!galleryId) return null;
  const targetSlug = galleryId.trim();
  const lowerSlug = targetSlug.toLowerCase();

  try {
    // 1. Try registry
    let raw = localStorage.getItem(`${STORAGE_PREFIX}public_registry`);
    if (!raw) {
      updatePublicGalleryRegistry();
      raw = localStorage.getItem(`${STORAGE_PREFIX}public_registry`);
    }

    if (raw) {
      const map = JSON.parse(raw);
      if (map[targetSlug]) return map[targetSlug];
      for (const k of Object.keys(map)) {
        if (k.toLowerCase() === lowerSlug || (map[k].album && map[k].album.id.toLowerCase() === lowerSlug)) {
          return map[k];
        }
      }
    }

    // 2. Direct deep scan across all tenant storage keys as fallback
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(`${STORAGE_PREFIX}albums_`)) {
        const ownerId = key.replace(`${STORAGE_PREFIX}albums_`, '');
        const albums: Album[] = JSON.parse(localStorage.getItem(key) || '[]');
        const matchedAlbum = albums.find(
          (a) => !a.isDeleted && (a.galleryId.toLowerCase() === lowerSlug || a.id.toLowerCase() === lowerSlug)
        );

        if (matchedAlbum) {
          const profile = getStudioProfile(ownerId);
          const photosRaw = localStorage.getItem(`${STORAGE_PREFIX}photos_${ownerId}`);
          const photos: Photo[] = photosRaw ? JSON.parse(photosRaw) : [];
          const albPhotos = photos.filter((p) => p.albumId === matchedAlbum.id && !p.isDeleted);
          
          const bundle: PublicGalleryBundle = {
            album: matchedAlbum,
            photos: albPhotos,
            studio: profile,
          };
          updatePublicGalleryRegistry();
          return bundle;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function incrementGalleryView(galleryId: string) {
  try {
    const bundle = getPublicGalleryBySlug(galleryId);
    if (!bundle) return;
    const { album } = bundle;
    const raw = localStorage.getItem(`${STORAGE_PREFIX}albums_${album.ownerId}`);
    if (!raw) return;
    const albums: Album[] = JSON.parse(raw);
    const updated = albums.map((a) => (a.id === album.id ? { ...a, viewsCount: (a.viewsCount || 0) + 1 } : a));
    localStorage.setItem(`${STORAGE_PREFIX}albums_${album.ownerId}`, JSON.stringify(updated));
  } catch {
    // Non-blocking view tracking
  }
}

export function incrementGalleryDownload(galleryId: string) {
  try {
    const bundle = getPublicGalleryBySlug(galleryId);
    if (!bundle) return;
    const { album } = bundle;
    const raw = localStorage.getItem(`${STORAGE_PREFIX}albums_${album.ownerId}`);
    if (!raw) return;
    const albums: Album[] = JSON.parse(raw);
    const updated = albums.map((a) => (a.id === album.id ? { ...a, downloadsCount: (a.downloadsCount || 0) + 1 } : a));
    localStorage.setItem(`${STORAGE_PREFIX}albums_${album.ownerId}`, JSON.stringify(updated));
  } catch {
    // Non-blocking download tracking
  }
}

// ---------------- SAAS PLATFORM TENANT LIST ----------------

export function getAllStudioTenants(): StudioTenantRecord[] {
  const tenants: StudioTenantRecord[] = [];

  // Check if real active user exists
  const activeUserRaw = localStorage.getItem('galerifotoqr_active_user');
  if (activeUserRaw) {
    try {
      const activeUser: UserAccount = JSON.parse(activeUserRaw);
      if (activeUser && activeUser.id) {
        const albums = getAlbumsForOwner(activeUser.id);
        const photos = getAllPhotosForOwner(activeUser.id);
        const profile = getStudioProfile(activeUser.id);
        tenants.push({
          id: activeUser.id,
          studioName: profile.studioName || activeUser.name + ' Studio',
          ownerName: activeUser.name,
          email: activeUser.email,
          plan: activeUser.subscriptionTier || 'pro',
          status: activeUser.subscriptionStatus === 'active' ? 'active' : 'trial',
          activeAlbumsCount: albums.length,
          totalPhotosCount: photos.length,
          driveConnected: !!activeUser.isConnectedToDrive,
          joinedAt: activeUser.createdAt ? new Date(activeUser.createdAt).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }) : 'Hari ini',
        });
      }
    } catch {
      // ignore
    }
  }

  return tenants;
}
