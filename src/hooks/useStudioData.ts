import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { StudioProfile, Album, TrashItem, ExpirationAction } from '../types';
import {
  getStudioProfile,
  saveStudioProfile,
  getAlbums,
  saveAlbum,
  syncPublicGalleryFromAlbum,
  moveAlbumToTrash,
  getTrashItems,
  restoreAlbumFromTrash,
  permanentDeleteAlbum,
  emptyTrash as emptyTrashDb,
} from '../services/dbService';
import {
  ensureAppFolders,
  createAlbumFolder,
  getDriveStorageQuota,
  validateDriveToken,
  deleteDrivePhoto,
} from '../services/googleDriveService';
import { generateGalleryId } from '../config/appConfig';

export interface StorageQuotaInfo {
  limit: number;
  usage: number;
  usageInDrive: number;
  usageInDriveTrash: number;
}

export interface CreateAlbumParams {
  albumName: string;
  clientName: string;
  eventName: string;
  eventDate?: string;
  pin: string;
  isPinEnabled: boolean;
  expirationDays: number;
  expirationAction: ExpirationAction;
}

export function useStudioData(user: User | null, accessToken: string | null) {
  const [profile, setProfile] = useState<StudioProfile | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [quota, setQuota] = useState<StorageQuotaInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load all studio data for current user UID
  const loadData = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setAlbums([]);
      setTrashItems([]);
      setQuota(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // 1. Load or initialize profile
      let userProfile = await getStudioProfile(user.uid);
      if (!userProfile) {
        userProfile = {
          uid: user.uid,
          studioName: user.displayName ? `${user.displayName} Photography` : 'Studio Foto Kami',
          ownerEmail: user.email || '',
          ownerName: user.displayName || 'Pemilik Studio',
          photoURL: user.photoURL || undefined,
          whatsappNumber: '',
          brandColor: '#2563eb',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveStudioProfile(userProfile);
      }
      setProfile(userProfile);

      // 2. Load albums & trash
      const [albumList, trashList] = await Promise.all([
        getAlbums(user.uid),
        getTrashItems(user.uid),
      ]);
      setAlbums(albumList);
      setTrashItems(trashList);

      // Auto-sync any existing albums to Firestore public_galleries collection
      if (albumList && albumList.length > 0) {
        Promise.all(
          albumList.map((a) =>
            syncPublicGalleryFromAlbum(a).catch((err) =>
              console.warn('[STUDIO] Background sync notice for gallery:', a.galleryId, err)
            )
          )
        ).catch(() => {});
      }

      // 3. Load Drive quota if token available
      if (accessToken) {
        try {
          const quotaData = await getDriveStorageQuota(accessToken);
          setQuota({
            limit: quotaData.limit,
            usage: quotaData.usage,
            usageInDrive: quotaData.usageInDrive,
            usageInDriveTrash: quotaData.usageInDriveTrash,
          });
        } catch (quotaErr) {
          console.warn('[GOOGLE_DRIVE] Quota fetch error (non-fatal):', quotaErr);
        }
      }
    } catch (err: any) {
      console.error('[STUDIO] Load data error:', err);
      setError(err?.message || 'Gagal memuat data studio.');
    } finally {
      setIsLoading(false);
    }
  }, [user, accessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Create Album
  const createNewAlbum = async (params: CreateAlbumParams): Promise<Album> => {
    setIsProcessing(true);
    setError(null);
    let createdDriveFolderId: string | null = null;

    try {
      // 1. Validate Google Login
      if (!user || !user.uid) {
        console.error('[CREATE_ALBUM_ERROR]\nstage: auth_validation\nHTTP status: 401\nmessage: Pengguna belum login ke Google');
        throw new Error('Pengguna belum login. Silakan login dengan akun Google Anda.');
      }
      console.log('[CREATE_ALBUM] auth validated');

      // 2. Validate Google Drive Access Token
      if (!accessToken || typeof accessToken !== 'string' || accessToken.trim() === '') {
        console.error('[CREATE_ALBUM_ERROR]\nstage: drive_token_validation\nHTTP status: 401\nmessage: Google Drive belum terhubung');
        throw new Error('Google Drive belum terhubung. Silakan hubungkan Google Drive terlebih dahulu.');
      }

      await validateDriveToken(accessToken);
      console.log('[CREATE_ALBUM] drive token validated');

      // 3. Create dedicated folder in Google Drive
      console.log('[CREATE_ALBUM] creating drive folder');
      const { customerAlbumsFolderId, rootFolderId } = await ensureAppFolders(accessToken);

      // Save root folder ID to profile if not yet saved
      if (profile && (!profile.driveRootFolderId || profile.driveRootFolderId !== rootFolderId)) {
        const updatedProfile = {
          ...profile,
          driveRootFolderId: rootFolderId,
          driveRootFolderName: 'GaleriFotoQR Cloud Studio',
        };
        setProfile(updatedProfile);
        saveStudioProfile(updatedProfile).catch(console.warn);
      }

      // Generate IDs
      const albumId = `alb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const galleryId = generateGalleryId();

      // Create folder under customer albums folder
      createdDriveFolderId = await createAlbumFolder(
        accessToken,
        params.albumName,
        galleryId,
        customerAlbumsFolderId
      );
      console.log('[CREATE_ALBUM] drive folder created');

      // 4. Calculate expiration
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + (params.expirationDays || 30));

      const newAlbum: Album = {
        albumId,
        galleryId,
        ownerUid: user.uid,
        studioId: user.uid,
        albumName: params.albumName.trim(),
        clientName: params.clientName.trim(),
        eventName: params.eventName.trim() || params.albumName.trim(),
        eventDate: params.eventDate || new Date().toISOString().split('T')[0],
        driveFolderId: createdDriveFolderId,
        driveFolderName: `${params.albumName} (${galleryId})`,
        pin: params.pin.trim(),
        isPinEnabled: params.isPinEnabled && Boolean(params.pin.trim()),
        expirationDate: expDate.toISOString(),
        expirationAction: params.expirationAction || 'disable',
        status: 'active',
        isPublished: true,
        photoCount: 0,
        photos: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 5. Persist metadata to Database
      try {
        await saveAlbum(newAlbum);
      } catch (metaErr: any) {
        console.error(`[CREATE_ALBUM_ERROR]\nstage: saving_metadata\nHTTP status: 500\nmessage: ${metaErr?.message || 'Gagal menyimpan metadata album'}`);
        // Safe Rollback: remove created Google Drive folder so no orphaned folder is left
        if (createdDriveFolderId) {
          console.warn('[CREATE_ALBUM] Rolling back created drive folder to avoid orphan:', createdDriveFolderId);
          try {
            await deleteDrivePhoto(accessToken, createdDriveFolderId);
          } catch (rollbackErr) {
            console.warn('[CREATE_ALBUM] Rollback notice:', rollbackErr);
          }
        }
        throw metaErr;
      }

      // 6. Update local state
      setAlbums((prev) => [newAlbum, ...prev.filter((a) => a.albumId !== newAlbum.albumId)]);

      console.log('[CREATE_ALBUM] completed');
      return newAlbum;
    } catch (err: any) {
      console.error('[CREATE_ALBUM] Failed to create album:', err?.message || err);
      setError(err?.message || 'Gagal membuat album baru.');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  // Update existing album
  const updateExistingAlbum = async (updatedAlbum: Album): Promise<void> => {
    if (!user) return;
    setIsProcessing(true);
    try {
      await saveAlbum(updatedAlbum);
      setAlbums((prev) => prev.map((a) => (a.albumId === updatedAlbum.albumId ? updatedAlbum : a)));
    } catch (err: any) {
      console.error('[ALBUM] Update error:', err);
      setError(err?.message || 'Gagal memperbarui album.');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  // Move album to trash
  const trashAlbum = async (albumId: string): Promise<void> => {
    if (!user) return;
    setIsProcessing(true);
    try {
      await moveAlbumToTrash(user.uid, albumId);
      setAlbums((prev) => prev.filter((a) => a.albumId !== albumId));
      const updatedTrash = await getTrashItems(user.uid);
      setTrashItems(updatedTrash);
    } catch (err: any) {
      console.error('[TRASH] Move to trash error:', err);
      setError(err?.message || 'Gagal memindahkan album ke keranjang sampah.');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  // Restore album
  const restoreAlbum = async (albumId: string): Promise<void> => {
    if (!user) return;
    setIsProcessing(true);
    try {
      await restoreAlbumFromTrash(user.uid, albumId);
      setTrashItems((prev) => prev.filter((t) => t.albumId !== albumId));
      const updatedAlbums = await getAlbums(user.uid);
      setAlbums(updatedAlbums);
    } catch (err: any) {
      console.error('[TRASH] Restore error:', err);
      setError(err?.message || 'Gagal memulihkan album.');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  // Permanently delete album
  const deletePermanent = async (albumId: string): Promise<void> => {
    if (!user) return;
    setIsProcessing(true);
    try {
      await permanentDeleteAlbum(user.uid, albumId);
      setTrashItems((prev) => prev.filter((t) => t.albumId !== albumId));
    } catch (err: any) {
      console.error('[TRASH] Permanent delete error:', err);
      setError(err?.message || 'Gagal menghapus album secara permanen.');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  // Empty entire trash
  const clearTrash = async (): Promise<void> => {
    if (!user) return;
    setIsProcessing(true);
    try {
      await emptyTrashDb(user.uid);
      setTrashItems([]);
    } catch (err: any) {
      console.error('[TRASH] Empty trash error:', err);
      setError(err?.message || 'Gagal mengosongkan keranjang sampah.');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  // Update Studio Profile
  const updateProfile = async (updates: Partial<StudioProfile>): Promise<void> => {
    if (!user || !profile) return;
    setIsProcessing(true);
    try {
      const updated: StudioProfile = {
        ...profile,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      await saveStudioProfile(updated);
      setProfile(updated);
    } catch (err: any) {
      console.error('[STUDIO] Update profile error:', err);
      setError(err?.message || 'Gagal memperbarui profil studio.');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    profile,
    albums,
    trashItems,
    quota,
    isLoading,
    isProcessing,
    error,
    refreshData: loadData,
    createNewAlbum,
    updateExistingAlbum,
    trashAlbum,
    restoreAlbum,
    deletePermanent,
    clearTrash,
    updateProfile,
  };
}
