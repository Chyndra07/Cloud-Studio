import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import { StudioProfile, Album, PublicGalleryData, ClientSelection, TrashItem } from '../types';
import { getApiBaseUrl } from '../config/appConfig';

// Local storage backup keys (per UID)
const getLocalKey = (prefix: string, uidOrKey: string) => `gfq_${prefix}_${uidOrKey}`;

// Timeout helper for Firestore operations to avoid hanging promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 8000, errorMsg: string = 'Operasi Firestore timeout'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), timeoutMs)),
  ]);
}

/**
 * Strips all `undefined` values and converts them to `null` or omits them,
 * preventing Firebase Firestore SDK from throwing "Unsupported field value: undefined" errors.
 */
function sanitizeForFirestore<T>(data: T): any {
  if (data === null || data === undefined) return null;
  return JSON.parse(
    JSON.stringify(data, (_, value) => {
      if (value === undefined) return null;
      return value;
    })
  );
}

/**
 * -------------------------------------------------------------
 * STUDIO PROFILE PERSISTENCE
 * -------------------------------------------------------------
 */
export async function getStudioProfile(uid: string): Promise<StudioProfile | null> {
  if (!uid) return null;
  console.log('[DATABASE] Fetching studio profile for UID:', uid);
  try {
    const docRef = doc(db, 'studios', uid);
    const snap = await withTimeout(getDoc(docRef), 6000, 'Get profile timeout');
    if (snap.exists()) {
      const data = snap.data() as StudioProfile;
      // Sync to local cache
      localStorage.setItem(getLocalKey('profile', uid), JSON.stringify(data));
      return data;
    }
  } catch (error) {
    console.warn('[DATABASE] Firestore read profile failed, checking local backup:', error);
  }

  // Fallback to local cache
  const local = localStorage.getItem(getLocalKey('profile', uid));
  if (local) {
    try {
      return JSON.parse(local) as StudioProfile;
    } catch {
      return null;
    }
  }
  return null;
}

export async function saveStudioProfile(profile: StudioProfile): Promise<void> {
  if (!profile || !profile.uid) return;
  console.log('[DATABASE] Saving studio profile for UID:', profile.uid);
  profile.updatedAt = new Date().toISOString();

  // Save to local cache first
  localStorage.setItem(getLocalKey('profile', profile.uid), JSON.stringify(profile));

  try {
    const docRef = doc(db, 'studios', profile.uid);
    await withTimeout(
      setDoc(docRef, sanitizeForFirestore(profile), { merge: true }),
      6000,
      'Save profile timeout'
    );
    console.log('[DATABASE] Firestore studio profile saved successfully');
  } catch (error) {
    console.warn('[DATABASE] Firestore save profile failed, saved locally:', error);
  }
}

/**
 * -------------------------------------------------------------
 * ALBUMS PERSISTENCE
 * -------------------------------------------------------------
 */
export async function getAlbums(uid: string): Promise<Album[]> {
  if (!uid) return [];
  console.log('[DATABASE] Fetching albums for UID:', uid);
  let albums: Album[] = [];

  try {
    const albumsCol = collection(db, 'studios', uid, 'albums');
    const q = query(albumsCol, orderBy('createdAt', 'desc'));
    const snap = await withTimeout(getDocs(q), 7000, 'Get albums timeout');
    
    albums = snap.docs.map((docSnap) => {
      const a = docSnap.data() as Album;
      if (a.galleryId) a.galleryId = a.galleryId.toUpperCase().trim();
      return a;
    });
    
    // Save to local cache
    localStorage.setItem(getLocalKey('albums', uid), JSON.stringify(albums));
    return albums;
  } catch (error) {
    console.warn('[DATABASE] Firestore fetch albums error, loading from local cache:', error);
    const local = localStorage.getItem(getLocalKey('albums', uid));
    if (local) {
      try {
        return JSON.parse(local) as Album[];
      } catch {
        return [];
      }
    }
    return [];
  }
}

export async function getAlbum(uid: string, albumId: string): Promise<Album | null> {
  if (!uid || !albumId) return null;
  try {
    const docRef = doc(db, 'studios', uid, 'albums', albumId);
    const snap = await withTimeout(getDoc(docRef), 6000, 'Get single album timeout');
    if (snap.exists()) {
      const a = snap.data() as Album;
      if (a.galleryId) a.galleryId = a.galleryId.toUpperCase().trim();
      return a;
    }
  } catch (err) {
    console.warn('[DATABASE] Firestore single album fetch error:', err);
  }

  const localAlbums = await getAlbums(uid);
  return localAlbums.find((a) => a.albumId === albumId) || null;
}

export async function saveAlbum(album: Album): Promise<void> {
  console.log('[CREATE_ALBUM] saving metadata for album:', album.albumId);
  if (album.galleryId) {
    album.galleryId = album.galleryId.toUpperCase().trim();
  }
  album.updatedAt = new Date().toISOString();

  // 1. Update local cache immediately for responsive UI
  const localKey = getLocalKey('albums', album.ownerUid);
  const local = localStorage.getItem(localKey);
  let albums: Album[] = local ? JSON.parse(local) : [];
  const index = albums.findIndex((a) => a.albumId === album.albumId);
  if (index >= 0) {
    albums[index] = album;
  } else {
    albums.unshift(album);
  }
  localStorage.setItem(localKey, JSON.stringify(albums));

  // 2. Save to Firestore under studio albums
  try {
    const docRef = doc(db, 'studios', album.ownerUid, 'albums', album.albumId);
    await withTimeout(
      setDoc(docRef, sanitizeForFirestore(album), { merge: true }),
      10000,
      `Gagal menyimpan album ke Firestore (studios/${album.ownerUid}/albums/${album.albumId})`
    );
    console.log('[DATABASE] Album saved to Firestore successfully under studio:', album.albumId);
  } catch (error: any) {
    console.error('[DATABASE_ERROR] Firestore save album failed:', error);
    throw new Error(`Gagal menyimpan album ke database: ${error?.message || error}`);
  }

  // 3. Sync public gallery document (MANDATORY Single Source of Truth for GitHub Pages & Clients)
  try {
    await syncPublicGalleryFromAlbum(album);
    console.log('[CREATE_ALBUM] Public gallery document synced successfully for GalleryId:', album.galleryId);
  } catch (pubErr: any) {
    console.error('[PUBLIC_GALLERY_ERROR] Failed to sync public gallery to Firestore:', pubErr);
    throw new Error(`Gagal mempublikasikan galeri publik: ${pubErr?.message || pubErr}`);
  }

  console.log('[CREATE_ALBUM] metadata saved completely');
}

export async function moveAlbumToTrash(uid: string, albumId: string): Promise<void> {
  console.log('[TRASH] Moving album to trash:', albumId);
  const album = await getAlbum(uid, albumId);
  if (!album) return;

  const cleanGalleryId = (album.galleryId || '').toUpperCase().trim();

  const trashItem: TrashItem = {
    albumId: album.albumId,
    galleryId: cleanGalleryId,
    albumName: album.albumName,
    clientName: album.clientName,
    photoCount: album.photoCount || 0,
    driveFolderId: album.driveFolderId,
    deletedAt: new Date().toISOString(),
    originalAlbumData: album,
  };

  // 1. Update local cache
  const localAlbums = (await getAlbums(uid)).filter((a) => a.albumId !== albumId);
  localStorage.setItem(getLocalKey('albums', uid), JSON.stringify(localAlbums));

  const localTrash = await getTrashItems(uid);
  localTrash.unshift(trashItem);
  localStorage.setItem(getLocalKey('trash', uid), JSON.stringify(localTrash));

  // 2. Sync to Firestore
  try {
    await deleteDoc(doc(db, 'studios', uid, 'albums', albumId));
    await setDoc(doc(db, 'studios', uid, 'trash', albumId), sanitizeForFirestore(trashItem));
    // Mark public gallery as disabled
    if (cleanGalleryId) {
      await deleteDoc(doc(db, 'public_galleries', cleanGalleryId));
    }
  } catch (err) {
    console.warn('[TRASH] Firestore trash move error:', err);
  }
}

/**
 * -------------------------------------------------------------
 * TRASH CAN PERSISTENCE
 * -------------------------------------------------------------
 */
export async function getTrashItems(uid: string): Promise<TrashItem[]> {
  if (!uid) return [];
  try {
    const trashCol = collection(db, 'studios', uid, 'trash');
    const snap = await getDocs(trashCol);
    const items = snap.docs.map((d) => d.data() as TrashItem);
    localStorage.setItem(getLocalKey('trash', uid), JSON.stringify(items));
    return items;
  } catch (err) {
    console.warn('[TRASH] Firestore fetch trash error:', err);
    const local = localStorage.getItem(getLocalKey('trash', uid));
    return local ? JSON.parse(local) : [];
  }
}

export async function restoreAlbumFromTrash(uid: string, albumId: string): Promise<void> {
  console.log('[TRASH] Restoring album from trash:', albumId);
  const trashItems = await getTrashItems(uid);
  const item = trashItems.find((t) => t.albumId === albumId);
  if (!item) return;

  const restoredAlbum = item.originalAlbumData;
  restoredAlbum.updatedAt = new Date().toISOString();
  if (restoredAlbum.galleryId) {
    restoredAlbum.galleryId = restoredAlbum.galleryId.toUpperCase().trim();
  }

  // 1. Update local cache
  const updatedTrash = trashItems.filter((t) => t.albumId !== albumId);
  localStorage.setItem(getLocalKey('trash', uid), JSON.stringify(updatedTrash));

  const localAlbums = await getAlbums(uid);
  localAlbums.unshift(restoredAlbum);
  localStorage.setItem(getLocalKey('albums', uid), JSON.stringify(localAlbums));

  // 2. Update Firestore
  try {
    await deleteDoc(doc(db, 'studios', uid, 'trash', albumId));
    await setDoc(
      doc(db, 'studios', uid, 'albums', albumId),
      sanitizeForFirestore(restoredAlbum)
    );
    await syncPublicGalleryFromAlbum(restoredAlbum);
  } catch (err) {
    console.warn('[TRASH] Firestore restore error:', err);
  }
}

export async function permanentDeleteAlbum(uid: string, albumId: string): Promise<void> {
  console.log('[TRASH] Permanently deleting album record:', albumId);
  // 1. Update local cache
  const trashItems = (await getTrashItems(uid)).filter((t) => t.albumId !== albumId);
  localStorage.setItem(getLocalKey('trash', uid), JSON.stringify(trashItems));

  // 2. Update Firestore
  try {
    await deleteDoc(doc(db, 'studios', uid, 'trash', albumId));
  } catch (err) {
    console.warn('[TRASH] Firestore permanent delete error:', err);
  }
}

export async function emptyTrash(uid: string): Promise<void> {
  console.log('[TRASH] Emptying trash for UID:', uid);
  const trashItems = await getTrashItems(uid);
  localStorage.setItem(getLocalKey('trash', uid), JSON.stringify([]));

  try {
    for (const item of trashItems) {
      await deleteDoc(doc(db, 'studios', uid, 'trash', item.albumId));
    }
  } catch (err) {
    console.warn('[TRASH] Firestore empty trash error:', err);
  }
}

/**
 * -------------------------------------------------------------
 * PUBLIC GALLERY (ACCESSIBLE TO CLIENTS WITHOUT LOGIN)
 * -------------------------------------------------------------
 */

/**
 * Helper to push public gallery metadata to Cloud Run backend
 */
async function syncToBackendApi(publicData: PublicGalleryData): Promise<void> {
  const customApiBase = getApiBaseUrl();

  const endpoints: string[] = [];

  // PRIORITAS UTAMA:
  // API production / Cloudflare Worker yang terhubung ke D1.
  if (customApiBase && customApiBase.trim() !== '') {
    endpoints.push(
      `${customApiBase.trim().replace(/\/+$/, '')}/api/gallery/sync`
    );
  }

  // FALLBACK:
  // Digunakan untuk environment yang menyediakan API pada domain yang sama.
  endpoints.push('/api/gallery/sync');

  let lastError: unknown = null;

  for (const ep of endpoints) {
    try {
      console.log('[PUBLIC_GALLERY] Trying sync endpoint:', ep);

      const response = await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(publicData),
      });

      // fetch() tidak otomatis error pada HTTP 404/500/501,
      // jadi status response wajib diperiksa.
      if (!response.ok) {
        const responseText = await response.text().catch(() => '');

        throw new Error(
          `HTTP ${response.status} ${response.statusText}${
            responseText ? ` - ${responseText}` : ''
          }`
        );
      }

      console.log(
        '[PUBLIC_GALLERY] Synced successfully to:',
        ep
      );

      return;
    } catch (error) {
      lastError = error;

      console.warn(
        '[PUBLIC_GALLERY] Sync endpoint failed:',
        ep,
        error
      );
    }
  }

  throw new Error(
    `Semua endpoint sinkronisasi galeri gagal.${
      lastError instanceof Error
        ? ` ${lastError.message}`
        : ''
    }`
  );
}

export async function syncPublicGalleryFromAlbum(album: Album): Promise<void> {
  const cleanGalleryId = (album.galleryId || '').toUpperCase().trim();
  if (!cleanGalleryId) {
    throw new Error('Gallery ID tidak valid untuk sinkronisasi galeri publik');
  }

  const profile = await getStudioProfile(album.ownerUid);

  const publicData: PublicGalleryData = {
    galleryId: cleanGalleryId,
    albumName: album.albumName || 'Album Foto',
    clientName: album.clientName || 'Pelanggan',
    eventName: album.eventName || album.albumName || 'Dokumentasi',
    eventDate: album.eventDate || '',
    pin: album.pin || '',
    isPinRequired: Boolean(album.isPinEnabled && album.pin),
    expirationDate: album.expirationDate || new Date(Date.now() + 30 * 86400000).toISOString(),
    isExpired: album.expirationDate ? new Date(album.expirationDate) < new Date() : false,
    status: album.status || 'active',
    photoCount: album.photoCount || (album.photos?.length ?? 0),
    coverPhotoUrl: album.coverPhotoUrl || (album.photos?.[0]?.thumbnailUrl || ''),
    photos: album.photos || [],
    studio: {
      studioName: profile?.studioName || 'Studio Foto Kami',
      logoUrl: profile?.logoUrl || '',
      whatsappNumber: profile?.whatsappNumber || '',
      emailContact: profile?.emailContact || '',
      brandColor: profile?.brandColor || '#2563eb',
      website: profile?.website || '',
    },
    createdAt: album.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 1. Local storage cache for instant offline / client access
  localStorage.setItem(`gfq_public_gallery_${cleanGalleryId}`, JSON.stringify(publicData));

  // 2. Firestore Public Galleries collection (MANDATORY Single Source of Truth)
  try {
    const pubDoc = doc(db, 'public_galleries', cleanGalleryId);
    await withTimeout(
      setDoc(pubDoc, sanitizeForFirestore(publicData), { merge: true }),
      10000,
      `Gagal menulis dokumen public_galleries/${cleanGalleryId} ke Firestore (timeout)`
    );
    console.log('[PUBLIC_GALLERY] Firestore public gallery document synced for ID:', cleanGalleryId);
  } catch (err: any) {
    console.error(`[FIRESTORE_WRITE_ERROR] Gagal menyimpan public_galleries/${cleanGalleryId}:`, err);
    throw new Error(`Gagal menyimpan galeri ke Firestore (public_galleries/${cleanGalleryId}): ${err?.message || err}`);
  }

  // 3. Sync to Cloud Run Backend storage (secondary fallback)
  syncToBackendApi(publicData).catch((e) => console.warn('[BACKEND_SYNC] Backend sync notice:', e));
}

export async function getPublicGalleryData(galleryId: string): Promise<PublicGalleryData | null> {
  if (!galleryId) return null;
  const cleanId = galleryId.toUpperCase().trim();
  console.log('[PUBLIC_GALLERY] Fetching public gallery data for GalleryId:', cleanId);

  // 1. First Priority: Firestore Public Collection (Single Source of Truth across all deployments/domains)
  try {
    const pubDoc = doc(db, 'public_galleries', cleanId);
    const snap = await withTimeout(getDoc(pubDoc), 10000, `Fetch public_galleries/${cleanId} timeout`);
    if (snap.exists()) {
      const data = snap.data() as PublicGalleryData;
      if (data && data.galleryId) {
        data.galleryId = data.galleryId.toUpperCase().trim();
        // Re-evaluate expiration date
        if (data.expirationDate) {
          data.isExpired = new Date(data.expirationDate).getTime() < Date.now();
          if (data.isExpired) {
            data.status = 'expired';
          }
        }
        localStorage.setItem(`gfq_public_gallery_${cleanId}`, JSON.stringify(data));
        console.log('[PUBLIC_GALLERY] Loaded from Firestore successfully for ID:', cleanId);
        return data;
      }
    } else {
      console.warn(`[PUBLIC_GALLERY] Document public_galleries/${cleanId} does not exist in Firestore.`);
    }
  } catch (err: any) {
    console.error(`[FIRESTORE_READ_ERROR] Error reading public_galleries/${cleanId} from Firestore:`, err);
  }

  // 2. Second Priority: Backend Cloud Run API (/api/gallery/:galleryId)
  const apiEndpoints = [`/api/gallery/${cleanId}`];
  const customApiBase = getApiBaseUrl();
  if (customApiBase && customApiBase.trim() !== '') {
    apiEndpoints.push(`${customApiBase.trim().replace(/\/+$/, '')}/api/gallery/${cleanId}`);
  }

  for (const ep of apiEndpoints) {
    try {
      const res = await fetch(ep);
      if (res.ok) {
        const json = await res.json();
        if (json && json.success && json.data) {
          const data = json.data as PublicGalleryData;
          data.galleryId = data.galleryId.toUpperCase().trim();
          localStorage.setItem(`gfq_public_gallery_${cleanId}`, JSON.stringify(data));
          console.log('[PUBLIC_GALLERY] Loaded from Backend API endpoint:', ep);
          return data;
        }
      }
    } catch {
      // ignore and try next
    }
  }

  // 3. Third Priority: Local Storage Direct Gallery Cache (only for same-device fallback)
  const local = localStorage.getItem(`gfq_public_gallery_${cleanId}`);
  if (local) {
    try {
      const data = JSON.parse(local) as PublicGalleryData;
      if (data && data.galleryId) {
        if (data.expirationDate) {
          data.isExpired = new Date(data.expirationDate).getTime() < Date.now();
          if (data.isExpired) {
            data.status = 'expired';
          }
        }
        console.log('[PUBLIC_GALLERY] Loaded from Local Storage cache for ID:', cleanId);
        // Attempt background re-sync to Firestore if it wasn't there
        syncToBackendApi(data).catch(() => {});
        return data;
      }
    } catch {
      // ignore corrupted json
    }
  }

  // 4. Fourth Priority: Scan all studio albums in local storage across all studio accounts
  if (typeof window !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('gfq_albums_')) {
        try {
          const list: Album[] = JSON.parse(localStorage.getItem(key) || '[]');
          const match = list.find((a) => (a.galleryId || '').toUpperCase().trim() === cleanId);
          if (match) {
            console.log('[PUBLIC_GALLERY] Reconstructed from local album store for ID:', cleanId);
            syncPublicGalleryFromAlbum(match).catch((err) => console.warn('[PUBLIC_GALLERY] Sync attempt notice:', err));
            const cached = localStorage.getItem(`gfq_public_gallery_${cleanId}`);
            if (cached) {
              return JSON.parse(cached) as PublicGalleryData;
            }
          }
        } catch {
          // ignore
        }
      }
    }
  }

  console.warn('[PUBLIC_GALLERY] Gallery not found in any storage for ID:', cleanId);
  return null;
}

/**
 * -------------------------------------------------------------
 * CLIENT FAVORITES & PHOTO SELECTION PERSISTENCE
 * -------------------------------------------------------------
 */
export async function getClientSelection(galleryId: string): Promise<ClientSelection> {
  const cleanId = (galleryId || '').toUpperCase().trim();
  const localKey = `gfq_client_selection_${cleanId}`;
  const local = localStorage.getItem(localKey);
  if (local) {
    try {
      return JSON.parse(local);
    } catch {
      // ignore
    }
  }

  // 1. Try Firestore
  try {
    const docRef = doc(db, 'public_galleries', cleanId, 'selections', 'client_picks');
    const snap = await withTimeout(getDoc(docRef), 5000, 'Selection fetch timeout');
    if (snap.exists()) {
      const data = snap.data() as ClientSelection;
      localStorage.setItem(localKey, JSON.stringify(data));
      return data;
    }
  } catch (err) {
    console.warn('[SELECTION] Firestore selection read notice:', err);
  }

  // 2. Try Backend API
  try {
    const res = await fetch(`/api/gallery/selection/${cleanId}`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data) {
        localStorage.setItem(localKey, JSON.stringify(json.data));
        return json.data;
      }
    }
  } catch {
    // ignore
  }

  return {
    galleryId: cleanId,
    selectedPhotoIds: [],
    notes: {},
    updatedAt: new Date().toISOString(),
  };
}

export async function saveClientSelection(selection: ClientSelection): Promise<void> {
  const cleanId = (selection.galleryId || '').toUpperCase().trim();
  selection.galleryId = cleanId;
  selection.updatedAt = new Date().toISOString();

  const localKey = `gfq_client_selection_${cleanId}`;
  localStorage.setItem(localKey, JSON.stringify(selection));

  // 1. Save to Firestore
  try {
    const docRef = doc(db, 'public_galleries', cleanId, 'selections', 'client_picks');
    await withTimeout(
      setDoc(docRef, sanitizeForFirestore(selection), { merge: true }),
      6000,
      'Save selection timeout'
    );
    console.log('[SELECTION] Saved client picks to Firestore for gallery:', cleanId);
  } catch (err) {
    console.warn('[SELECTION] Firestore save selection warning:', err);
  }

  // 2. Save to Backend API
  try {
    await fetch('/api/gallery/selection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selection),
    });
  } catch {
    // ignore
  }
}
