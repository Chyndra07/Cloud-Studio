import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, 
  Upload, 
  Trash2, 
  QrCode, 
  ExternalLink, 
  Download, 
  Lock, 
  Calendar, 
  User, 
  Check, 
  Copy, 
  FileArchive, 
  Eye, 
  X, 
  HardDrive,
  ImageIcon,
  Sparkles,
  AlertCircle,
  FolderOpen,
  FolderUp,
  FolderTree,
  FolderCheck,
  Layers,
  Settings,
  Filter,
  Grid,
  ListFilter,
  FolderPlus,
  FolderInput,
  MoreVertical,
  Edit2,
  Folder,
  CheckCircle2
} from 'lucide-react';
import JSZip from 'jszip';
import { Album, Photo, StudioProfile, UserAccount } from '../types';
import { 
  uploadPhotoFileToDrive, 
  getOrCreateDriveFolderPath, 
  createFolderInAlbumDrive, 
  moveDriveFile, 
  renameDriveFolder,
  getDriveFileMetadata
} from '../services/googleDrive';
import { getStoredUserToken } from '../services/googleAuth';
import { getPublicGalleryUrl } from '../services/urlHelper';
import { 
  republishAlbum, 
  addFolderToAlbum, 
  movePhotosToFolder, 
  renameFolderInAlbum, 
  deleteFolderInAlbum 
} from '../services/storageService';
import { scanDroppedEntries } from '../services/folderUploadEngine';
import { 
  formatPhotoSize, 
  formatPhotoMeta, 
  getCachedDriveMeta, 
  setCachedDriveMeta,
  downloadOriginalPhotoFile,
  downloadOriginalPhotosZip
} from '../services/photoService';

interface AlbumDetailProps {
  album: Album;
  photos: Photo[];
  studioProfile: StudioProfile;
  user: UserAccount | null;
  onBack: () => void;
  onOpenQRCode: (album: Album) => void;
  onOpenSettings?: (album: Album) => void;
  onOpenUploadFolder?: (album: Album) => void;
  onAddPhotos: (photos: Photo[]) => void;
  onDeletePhoto: (photoId: string) => void;
  onMoveAlbumToTrash: (albumId: string) => void;
  onUpdateAlbum?: (albumId: string, updates: Partial<Album>) => Promise<void> | void;
  onRefreshTenantData?: () => void;
}

export const AlbumDetail: React.FC<AlbumDetailProps> = ({
  album,
  photos,
  studioProfile,
  user,
  onBack,
  onOpenQRCode,
  onOpenSettings,
  onOpenUploadFolder,
  onAddPhotos,
  onDeletePhoto,
  onMoveAlbumToTrash,
  onUpdateAlbum,
  onRefreshTenantData,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [isRepublishing, setIsRepublishing] = useState(false);
  const [republishSuccess, setRepublishSuccess] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null);

  // Local reactive states for album and photos to guarantee instant UI updates
  const [localAlbum, setLocalAlbum] = useState<Album>(album);
  const [localPhotos, setLocalPhotos] = useState<Photo[]>(photos);

  useEffect(() => {
    setLocalAlbum(album);
  }, [album]);

  useEffect(() => {
    setLocalPhotos(photos);
  }, [photos]);

  // Auto-enrich photo metadata (size, width, height) from Google Drive if missing
  useEffect(() => {
    if (!user) return;
    const token = getStoredUserToken(user.id) || user.accessToken;
    if (!token) return;

    let isMounted = true;
    const missingPhotos = localPhotos.filter((p) => 
      !p.isDeleted && 
      p.driveFileId && 
      !p.driveFileId.startsWith('mock_') && 
      !p.driveFileId.startsWith('local_') && 
      (!p.fileSize || p.fileSize === 0 || !p.width || !p.height)
    );

    if (missingPhotos.length === 0) return;

    const enrichBatch = async () => {
      let hasUpdates = false;
      const updatedPhotosMap = new Map<string, Partial<Photo>>();

      for (const p of missingPhotos.slice(0, 25)) {
        const cached = getCachedDriveMeta(p.driveFileId);
        if (cached && (cached.size || cached.width)) {
          updatedPhotosMap.set(p.id, {
            fileSize: cached.size || p.fileSize,
            width: cached.width || p.width,
            height: cached.height || p.height,
          });
          hasUpdates = true;
        } else {
          try {
            const meta = await getDriveFileMetadata(token, p.driveFileId);
            if (meta) {
              setCachedDriveMeta(p.driveFileId, meta);
              updatedPhotosMap.set(p.id, {
                fileSize: meta.size || p.fileSize,
                width: meta.width || p.width,
                height: meta.height || p.height,
              });
              hasUpdates = true;
            }
          } catch {
            // non-blocking
          }
        }
      }

      if (hasUpdates && isMounted) {
        setLocalPhotos((prev) =>
          prev.map((photo) => {
            const update = updatedPhotosMap.get(photo.id);
            return update ? { ...photo, ...update } : photo;
          })
        );
      }
    };

    enrichBatch();

    return () => {
      isMounted = false;
    };
  }, [user, localAlbum.id, localPhotos.length]);

  // Folder Filtering & View Modes
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>('all');
  const [selectedSubfolderFilter, setSelectedSubfolderFilter] = useState<string>('all');
  const [viewGroupedMode, setViewGroupedMode] = useState<boolean>(false);
  const [explicitUploadTargetFolder, setExplicitUploadTargetFolder] = useState<string>('');

  // Folder Menu & Management States
  const [activeFolderMenu, setActiveFolderMenu] = useState<string | null>(null);
  const [renameModalFolder, setRenameModalFolder] = useState<string | null>(null);
  const [renameInputValue, setRenameInputValue] = useState<string>('');
  const [isRenamingFolder, setIsRenamingFolder] = useState<boolean>(false);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<string | null>(null);

  // Modal: + Buat Folder Baru
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [newFolderNameInput, setNewFolderNameInput] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [createFolderError, setCreateFolderError] = useState<string | null>(null);

  // Modal: Pindahkan ke Folder
  const [isMovePhotosModalOpen, setIsMovePhotosModalOpen] = useState(false);
  const [targetMoveFolderName, setTargetMoveFolderName] = useState<string>('');
  const [isMovingPhotos, setIsMovingPhotos] = useState(false);
  const [moveStep, setMoveStep] = useState<'select' | 'confirm' | 'progress'>('select');
  const [isInlineCreateInMove, setIsInlineCreateInMove] = useState(false);
  const [inlineFolderNameInMove, setInlineFolderNameInMove] = useState('');
  const [isCreatingInlineFolder, setIsCreatingInlineFolder] = useState(false);
  const [notificationBanner, setNotificationBanner] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);

  // Upload Progress State for Direct File Uploads
  const [uploadProgress, setUploadProgress] = useState<{
    totalFiles: number;
    uploadedFiles: number;
    currentFileName: string;
    percent: number;
    isUploading: boolean;
  }>({
    totalFiles: 0,
    uploadedFiles: 0,
    currentFileName: '',
    percent: 0,
    isUploading: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activePhotos = useMemo(() => localPhotos.filter((p) => !p.isDeleted), [localPhotos]);
  const galleryUrl = getPublicGalleryUrl(localAlbum.galleryId, studioProfile.customGalleryDomain);

  // Auto-dismiss notification banner
  useEffect(() => {
    if (notificationBanner) {
      const timer = setTimeout(() => setNotificationBanner(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notificationBanner]);

  // Extract distinct folders and subfolders from active photos & album customFolders
  const folderStructure = useMemo(() => {
    const foldersMap = new Map<string, {
      name: string;
      count: number;
      subfolders: Set<string>;
    }>();

    let directPhotosCount = 0;

    for (const photo of activePhotos) {
      if (photo.folderName && photo.folderName.trim() && photo.folderName !== 'Foto Langsung') {
        const fName = photo.folderName.trim();
        if (!foldersMap.has(fName)) {
          foldersMap.set(fName, {
            name: fName,
            count: 0,
            subfolders: new Set<string>(),
          });
        }
        const item = foldersMap.get(fName)!;
        item.count++;
        if (photo.subfolder && photo.subfolder.trim()) {
          item.subfolders.add(photo.subfolder.trim());
        }
      } else {
        directPhotosCount++;
      }
    }

    // Merge any custom folders registered in album (e.g. newly created 0-photo empty folders)
    if (localAlbum.customFolders && Array.isArray(localAlbum.customFolders)) {
      for (const cf of localAlbum.customFolders) {
        if (cf && cf.trim() && cf !== 'Foto Langsung' && !foldersMap.has(cf.trim())) {
          foldersMap.set(cf.trim(), {
            name: cf.trim(),
            count: 0,
            subfolders: new Set<string>(),
          });
        }
      }
    }

    const folderList = Array.from(foldersMap.values()).map((f) => ({
      name: f.name,
      count: f.count,
      subfolders: Array.from(f.subfolders),
    }));

    return {
      hasFolders: folderList.length > 0 || directPhotosCount > 0,
      folderList,
      directPhotosCount,
    };
  }, [activePhotos, localAlbum.customFolders]);

  // Determine effective Active Upload Target based on active folder tab or explicit selection
  const resolvedUploadTarget = useMemo(() => {
    // 1. If currently viewing a specific folder
    if (selectedFolderFilter !== 'all' && selectedFolderFilter !== '__direct__') {
      const activeSub = selectedSubfolderFilter !== 'all' ? selectedSubfolderFilter.trim() : '';
      return {
        type: 'folder' as const,
        folderName: selectedFolderFilter.trim(),
        subfolder: activeSub,
        folderPath: activeSub ? `${selectedFolderFilter.trim()}/${activeSub}` : selectedFolderFilter.trim(),
        label: activeSub ? `${selectedFolderFilter.trim()} / ${activeSub}` : selectedFolderFilter.trim(),
      };
    }

    // 2. If explicitly viewing "Foto Langsung"
    if (selectedFolderFilter === '__direct__') {
      return {
        type: 'direct' as const,
        folderName: '',
        subfolder: '',
        folderPath: '',
        label: 'Foto Langsung (Tanpa Folder)',
      };
    }

    // 3. When viewing "Semua Foto" (Mode Tampilan, BUKAN Folder Fisik)
    // Use last explicit folder target if it exists in current folders
    if (explicitUploadTargetFolder && explicitUploadTargetFolder !== '__direct__') {
      const exists = folderStructure.folderList.some((f) => f.name === explicitUploadTargetFolder);
      if (exists) {
        return {
          type: 'folder' as const,
          folderName: explicitUploadTargetFolder.trim(),
          subfolder: '',
          folderPath: explicitUploadTargetFolder.trim(),
          label: explicitUploadTargetFolder.trim(),
        };
      }
    }

    // If album has structured folders, default target to the first available folder
    if (folderStructure.folderList.length > 0) {
      const firstFolder = folderStructure.folderList[0].name.trim();
      return {
        type: 'folder' as const,
        folderName: firstFolder,
        subfolder: '',
        folderPath: firstFolder,
        label: firstFolder,
      };
    }

    // Otherwise, default to Foto Langsung
    return {
      type: 'direct' as const,
      folderName: '',
      subfolder: '',
      folderPath: '',
      label: 'Foto Langsung (Tanpa Folder)',
    };
  }, [selectedFolderFilter, selectedSubfolderFilter, explicitUploadTargetFolder, folderStructure.folderList]);

  // Filtered photos based on active folder & subfolder selection
  const displayedPhotos = useMemo(() => {
    return activePhotos.filter((p) => {
      if (selectedFolderFilter === 'all') return true;
      if (selectedFolderFilter === '__direct__') {
        return !p.folderName || p.folderName === 'Foto Langsung';
      }

      const matchFolder = p.folderName === selectedFolderFilter;
      if (!matchFolder) return false;

      if (selectedSubfolderFilter !== 'all') {
        return p.subfolder === selectedSubfolderFilter;
      }

      return true;
    });
  }, [activePhotos, selectedFolderFilter, selectedSubfolderFilter]);

  // Grouped map for Grouped View
  const groupedSections = useMemo(() => {
    const map = new Map<string, Photo[]>();

    for (const p of activePhotos) {
      const groupKey = p.folderName && p.folderName.trim() ? p.folderName.trim() : 'Foto Langsung';
      if (!map.has(groupKey)) {
        map.set(groupKey, []);
      }
      map.get(groupKey)!.push(p);
    }

    // Also include empty custom folders if they exist
    if (localAlbum.customFolders && Array.isArray(localAlbum.customFolders)) {
      for (const cf of localAlbum.customFolders) {
        if (cf && cf.trim() && !map.has(cf.trim())) {
          map.set(cf.trim(), []);
        }
      }
    }

    return Array.from(map.entries()).map(([name, items]) => ({
      folderName: name,
      photos: items,
    }));
  }, [activePhotos, localAlbum.customFolders]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(galleryUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyPin = () => {
    const pin = (localAlbum.passwordHash || localAlbum.pinHash || '').trim();
    if (!pin) return;
    navigator.clipboard.writeText(pin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const handleRepublish = async () => {
    setIsRepublishing(true);
    setRepublishSuccess(false);
    const result = await republishAlbum(localAlbum, localAlbum.ownerId);
    setIsRepublishing(false);
    if (result.success) {
      setRepublishSuccess(true);
      setTimeout(() => setRepublishSuccess(false), 3000);
    } else {
      alert(`Gagal mempublikasikan: ${result.error || 'Terjadi kesalahan'}`);
    }
  };

  // Direct file upload handler targeting the ACTIVE FOLDER in Google Drive
  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const token = user ? getStoredUserToken(user.id) || user.accessToken : null;

    const target = resolvedUploadTarget;
    const isTargetFolder = target.type === 'folder' && Boolean(target.folderName.trim());
    const targetFolderName = isTargetFolder ? target.folderName.trim() : '';
    const targetSubfolder = isTargetFolder && target.subfolder ? target.subfolder.trim() : '';
    const targetFolderPath = isTargetFolder ? target.folderPath : '';

    setUploadProgress({
      totalFiles: fileArray.length,
      uploadedFiles: 0,
      currentFileName: fileArray[0].name,
      percent: 0,
      isUploading: true,
    });

    // Resolve target Google Drive folder ID for the active folder target
    let targetDriveFolderId = localAlbum.driveFolderId || (localAlbum as any).googleDriveFolderId;
    if (token && targetDriveFolderId && isTargetFolder) {
      try {
        const pathSegments = targetSubfolder ? [targetFolderName, targetSubfolder] : [targetFolderName];
        targetDriveFolderId = await getOrCreateDriveFolderPath(token, targetDriveFolderId, pathSegments);
      } catch (err) {
        console.warn('Failed to get or create target Drive folder path, falling back to root album folder:', err);
      }
    }

    const newlyCreatedPhotos: Photo[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];

      setUploadProgress((prev) => ({
        ...prev,
        currentFileName: file.name,
        uploadedFiles: i,
        percent: Math.round((i / fileArray.length) * 100),
      }));

      try {
        let driveResult = null;
        if (token && targetDriveFolderId) {
          driveResult = await uploadPhotoFileToDrive(token, targetDriveFolderId, file);
        }

        const objectUrl = URL.createObjectURL(file);
        const photoId = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        const newPhoto: Photo = {
          id: photoId,
          albumId: localAlbum.id,
          ownerId: localAlbum.ownerId || user?.id || 'demo_owner',
          driveFileId: driveResult?.id || `local_${photoId}`,
          filename: file.name,
          mimeType: file.type || 'image/jpeg',
          thumbnailUrl: driveResult?.thumbnailUrl || objectUrl,
          previewUrl: driveResult?.previewUrl || objectUrl,
          downloadUrl: driveResult?.downloadUrl || objectUrl,
          width: driveResult?.width || undefined,
          height: driveResult?.height || undefined,
          fileSize: driveResult?.size || file.size,
          uploadedAt: new Date().toISOString(),
          isDeleted: false,
          folderName: targetFolderName,
          subfolder: targetSubfolder,
          folderPath: targetFolderPath,
          driveFolderId: targetDriveFolderId || undefined,
        };

        newlyCreatedPhotos.push(newPhoto);
      } catch (err) {
        console.error('Failed to upload file:', file.name, err);
      }
    }

    setUploadProgress((prev) => ({
      ...prev,
      uploadedFiles: fileArray.length,
      percent: 100,
      isUploading: false,
    }));

    if (newlyCreatedPhotos.length > 0) {
      onAddPhotos(newlyCreatedPhotos);
      setLocalPhotos((prev) => [...newlyCreatedPhotos, ...prev]);
      if (isTargetFolder) {
        setExplicitUploadTargetFolder(targetFolderName);
      }
      setNotificationBanner({
        type: 'success',
        message: `${newlyCreatedPhotos.length} foto berhasil diunggah ke ${target.label || 'Foto Langsung'}.`,
      });
      onRefreshTenantData?.();
    }
  };

  // -------------------------------------------------------------
  // FEATURE 1: BUAT FOLDER BARU (Google Drive + Local Storage)
  // -------------------------------------------------------------
  const handleCreateFolderSubmit = async () => {
    if (!newFolderNameInput.trim()) {
      setCreateFolderError('Nama folder tidak boleh kosong.');
      return;
    }

    const cleanName = newFolderNameInput.trim().replace(/[\\/:*?"<>|]/g, '-');
    if (!cleanName) {
      setCreateFolderError('Nama folder tidak valid.');
      return;
    }

    // Check if folder already exists
    const exists = folderStructure.folderList.some(
      (f) => f.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (exists) {
      setCreateFolderError(`Folder "${cleanName}" sudah ada.`);
      return;
    }

    setIsCreatingFolder(true);
    setCreateFolderError(null);

    try {
      const token = user ? getStoredUserToken(user.id) || user.accessToken : null;
      const albumFolderId = localAlbum.driveFolderId || (localAlbum as any).googleDriveFolderId;

      // 1. Physically create folder in Google Drive
      if (token && albumFolderId) {
        try {
          await createFolderInAlbumDrive(token, albumFolderId, cleanName);
        } catch (err: any) {
          console.warn('Google Drive create folder warning:', err);
        }
      }

      // 2. Persist in storage & metadata
      if (user) {
        const updatedAlbum = addFolderToAlbum(user.id, localAlbum.id, cleanName);
        if (updatedAlbum) {
          setLocalAlbum(updatedAlbum);
          onUpdateAlbum?.(localAlbum.id, { customFolders: updatedAlbum.customFolders });
        }
      }

      // 3. Immediately set as active filter and target upload
      setSelectedFolderFilter(cleanName);
      setExplicitUploadTargetFolder(cleanName);
      setSelectedSubfolderFilter('all');

      setIsCreateFolderModalOpen(false);
      setNewFolderNameInput('');
      setNotificationBanner({
        type: 'success',
        message: `Folder "${cleanName}" berhasil dibuat di Google Drive.`,
      });

      onRefreshTenantData?.();
    } catch (err: any) {
      setCreateFolderError(err.message || 'Gagal membuat folder di Google Drive.');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // -------------------------------------------------------------
  // FEATURE 2: PINDAHKAN FOTO KE FOLDER (Move Google Drive + Metadata)
  // -------------------------------------------------------------
  const handleExecuteMovePhotos = async () => {
    if (selectedPhotoIds.length === 0) return;

    setIsMovingPhotos(true);
    setMoveStep('progress');

    const token = user ? getStoredUserToken(user.id) || user.accessToken : null;
    const albumRootDriveFolderId = localAlbum.driveFolderId || (localAlbum as any).googleDriveFolderId;
    const isDirect = !targetMoveFolderName.trim();
    const cleanTargetName = isDirect ? '' : targetMoveFolderName.trim();

    try {
      let destDriveFolderId = albumRootDriveFolderId;

      // 1. Resolve destination Google Drive folder ID
      if (token && albumRootDriveFolderId && !isDirect) {
        try {
          destDriveFolderId = await getOrCreateDriveFolderPath(
            token,
            albumRootDriveFolderId,
            [cleanTargetName]
          );
        } catch (err) {
          console.warn('Failed to resolve destination Drive folder ID:', err);
        }
      }

      // 2. Move physical files in Google Drive
      const photosToMove = activePhotos.filter((p) => selectedPhotoIds.includes(p.id));
      if (token && destDriveFolderId) {
        for (const photo of photosToMove) {
          if (photo.driveFileId && !photo.driveFileId.startsWith('local_')) {
            try {
              await moveDriveFile(token, photo.driveFileId, destDriveFolderId, photo.driveFolderId);
            } catch (moveErr) {
              console.warn(`Failed to physically move file ${photo.filename} on Google Drive:`, moveErr);
            }
          }
        }
      }

      // 3. Update database / local storage metadata
      if (user) {
        const updated = movePhotosToFolder(
          user.id,
          localAlbum.id,
          selectedPhotoIds,
          cleanTargetName,
          '',
          cleanTargetName,
          destDriveFolderId
        );
        if (updated && updated.length > 0) {
          setLocalPhotos(updated);
        }
      }

      // 4. Update UI state
      const count = selectedPhotoIds.length;
      const destLabel = isDirect ? 'Foto Langsung' : cleanTargetName;
      setSelectedPhotoIds([]);
      setIsMovePhotosModalOpen(false);
      setMoveStep('select');

      setNotificationBanner({
        type: 'success',
        message: `${count} foto berhasil dipindahkan ke "${destLabel}".`,
      });

      onRefreshTenantData?.();
    } catch (err: any) {
      alert(`Gagal memindahkan foto: ${err.message || 'Terjadi kesalahan sistem'}`);
    } finally {
      setIsMovingPhotos(false);
    }
  };

  // Inline folder creation inside Move dialog
  const handleCreateInlineFolderInMove = async () => {
    if (!inlineFolderNameInMove.trim()) return;
    const cleanName = inlineFolderNameInMove.trim().replace(/[\\/:*?"<>|]/g, '-');
    if (!cleanName) return;

    setIsCreatingInlineFolder(true);
    try {
      const token = user ? getStoredUserToken(user.id) || user.accessToken : null;
      const albumFolderId = localAlbum.driveFolderId || (localAlbum as any).googleDriveFolderId;

      if (token && albumFolderId) {
        try {
          await createFolderInAlbumDrive(token, albumFolderId, cleanName);
        } catch {}
      }

      if (user) {
        const updatedAlbum = addFolderToAlbum(user.id, localAlbum.id, cleanName);
        if (updatedAlbum) {
          setLocalAlbum(updatedAlbum);
        }
      }

      // Auto-select this newly created folder as the move destination
      setTargetMoveFolderName(cleanName);
      setIsInlineCreateInMove(false);
      setInlineFolderNameInMove('');
    } catch (err: any) {
      alert(err.message || 'Gagal membuat folder baru.');
    } finally {
      setIsCreatingInlineFolder(false);
    }
  };

  // -------------------------------------------------------------
  // FEATURE 3: RENAME & DELETE FOLDER
  // -------------------------------------------------------------
  const handleRenameFolderSubmit = async () => {
    if (!renameModalFolder || !renameInputValue.trim()) return;
    const oldName = renameModalFolder.trim();
    const newName = renameInputValue.trim().replace(/[\\/:*?"<>|]/g, '-');
    if (oldName === newName) {
      setRenameModalFolder(null);
      return;
    }

    setIsRenamingFolder(true);
    try {
      const token = user ? getStoredUserToken(user.id) || user.accessToken : null;
      const albumFolderId = localAlbum.driveFolderId || (localAlbum as any).googleDriveFolderId;

      // Rename physical Google Drive folder if possible
      if (token && albumFolderId) {
        try {
          const driveF = await getOrCreateDriveFolderPath(token, albumFolderId, [oldName]);
          if (driveF) {
            await renameDriveFolder(token, driveF, newName);
          }
        } catch (err) {
          console.warn('Drive folder rename notice:', err);
        }
      }

      if (user) {
        const res = renameFolderInAlbum(user.id, localAlbum.id, oldName, newName);
        if (res.album) setLocalAlbum(res.album);
        if (res.photos) setLocalPhotos(res.photos);
      }

      if (selectedFolderFilter === oldName) {
        setSelectedFolderFilter(newName);
      }
      if (explicitUploadTargetFolder === oldName) {
        setExplicitUploadTargetFolder(newName);
      }

      setRenameModalFolder(null);
      setRenameInputValue('');
      setNotificationBanner({
        type: 'success',
        message: `Folder "${oldName}" berhasil diubah menjadi "${newName}".`,
      });
      onRefreshTenantData?.();
    } catch (err: any) {
      alert(`Gagal mengubah nama folder: ${err.message || 'Error'}`);
    } finally {
      setIsRenamingFolder(false);
    }
  };

  const handleDeleteFolderSubmit = async (deletePhotos: boolean) => {
    if (!deleteFolderTarget) return;
    const targetName = deleteFolderTarget.trim();

    try {
      if (user) {
        const res = deleteFolderInAlbum(user.id, localAlbum.id, targetName, deletePhotos);
        if (res.album) setLocalAlbum(res.album);
        if (res.photos) setLocalPhotos(res.photos);
      }

      if (selectedFolderFilter === targetName) {
        setSelectedFolderFilter('all');
      }
      if (explicitUploadTargetFolder === targetName) {
        setExplicitUploadTargetFolder('');
      }

      setDeleteFolderTarget(null);
      setNotificationBanner({
        type: 'info',
        message: `Folder "${targetName}" berhasil dihapus.`,
      });
      onRefreshTenantData?.();
    } catch (err: any) {
      alert(`Gagal menghapus folder: ${err.message || 'Error'}`);
    }
  };

  // Selection handlers
  const toggleSelectPhoto = (id: string) => {
    setSelectedPhotoIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const selectAllPhotos = () => {
    if (selectedPhotoIds.length === displayedPhotos.length && displayedPhotos.length > 0) {
      setSelectedPhotoIds([]);
    } else {
      setSelectedPhotoIds(displayedPhotos.map((p) => p.id));
    }
  };

  const handleBatchDelete = () => {
    if (selectedPhotoIds.length === 0) return;
    if (confirm(`Pindahkan ${selectedPhotoIds.length} foto terpilih ke Sampah?`)) {
      selectedPhotoIds.forEach((id) => onDeletePhoto(id));
      setSelectedPhotoIds([]);
    }
  };

  // ZIP Download with Folder Structure Preservation (100% Original Lossless Binary)
  const handleDownloadZip = async () => {
    const targetPhotos = selectedPhotoIds.length > 0
      ? activePhotos.filter((p) => selectedPhotoIds.includes(p.id))
      : activePhotos;

    if (targetPhotos.length === 0) {
      alert('Tidak ada foto untuk diunduh.');
      return;
    }

    setIsZipping(true);

    try {
      const cleanEventName = localAlbum.eventName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const zipName = `${cleanEventName}_Semua_Foto_Original.zip`;

      await downloadOriginalPhotosZip(
        targetPhotos,
        zipName,
        undefined,
        localAlbum.galleryId || localAlbum.id
      );
    } catch (err: any) {
      alert(`Gagal membuat file ZIP: ${err.message || 'File original tidak dapat diunduh. Silakan coba kembali.'}`);
    } finally {
      setIsZipping(false);
    }
  };

  // Drag & drop loose files
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {notificationBanner && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-md transition-all ${
          notificationBanner.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : notificationBanner.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-900'
            : 'bg-blue-50 border-blue-200 text-blue-900'
        }`}>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-xs font-bold leading-relaxed">{notificationBanner.message}</p>
          </div>
          <button
            onClick={() => setNotificationBanner(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
            title="Kembali ke Daftar Album"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">
                {localAlbum.eventName}
              </h1>
              {(localAlbum.isPasswordProtected || localAlbum.pinEnabled) && (localAlbum.passwordHash || localAlbum.pinHash) && (
                <button
                  type="button"
                  onClick={handleCopyPin}
                  className="px-2 py-0.5 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[11px] font-bold flex items-center gap-1 shadow-2xs transition active:scale-95 cursor-pointer"
                  title="Klik untuk salin PIN"
                >
                  <Lock className="w-3 h-3 text-amber-800 shrink-0" />
                  <span>{copiedPin ? 'Tersalin!' : `PIN: ${localAlbum.passwordHash || localAlbum.pinHash}`}</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1 font-medium">
                <User className="w-3.5 h-3.5" />
                {localAlbum.customerName}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {localAlbum.eventDate}
              </span>
              <span>•</span>
              <span className="font-semibold text-blue-600">
                {activePhotos.length} Foto Total
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {onOpenSettings && (
            <button
              onClick={() => onOpenSettings(localAlbum)}
              className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-slate-200"
            >
              <Settings className="w-4 h-4 text-slate-600" />
              <span>Pengaturan</span>
            </button>
          )}

          <button
            onClick={handleRepublish}
            disabled={isRepublishing}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border shadow-2xs ${
              republishSuccess
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
            }`}
          >
            {isRepublishing ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                <span>Memperbarui...</span>
              </>
            ) : republishSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>Terpublikasi!</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Publikasikan Ulang</span>
              </>
            )}
          </button>

          <button
            onClick={() => onOpenQRCode(localAlbum)}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
          >
            <QrCode className="w-4 h-4" />
            <span>QR & Link Klien</span>
          </button>
        </div>
      </div>

      {/* Upload Zone Split Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Upload Folder Komplit (Folder Picker) */}
        <div
          onClick={() => {
            if (onOpenUploadFolder) {
              onOpenUploadFolder(localAlbum);
            }
          }}
          className="relative bg-white border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-2xl p-6 transition group cursor-pointer shadow-2xs flex flex-col justify-between"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold group-hover:scale-105 transition shrink-0">
              <FolderUp className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition">
                  Upload Folder (Pertahankan Struktur)
                </h3>
                <span className="text-[10px] font-bold uppercase bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  Disarankan
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Pilih folder dari laptop Anda (contoh: <em>01. Akad</em>, <em>02. Resepsi</em>). Struktur folder & subfolder akan dipertahankan utuh di Google Drive dan Galeri.
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-600">
            <span className="flex items-center gap-1.5">
              <FolderTree className="w-4 h-4" />
              Pilih Folder Komplit
            </span>
            <span className="text-[11px] text-slate-400 group-hover:text-blue-500 font-medium">
              Buka Folder Picker →
            </span>
          </div>
        </div>

        {/* Card 2: Pilih File / Upload Foto Satuan (Targeting Active Folder) */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative bg-white border-2 border-dashed rounded-2xl p-6 transition group cursor-pointer shadow-2xs flex flex-col justify-between ${
            isDragging ? 'border-blue-600 bg-blue-50/50' : 'border-slate-300 hover:border-slate-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold group-hover:scale-105 transition shrink-0">
              <Upload className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-slate-700 transition">
                  Pilih File / Upload Foto Satuan
                </h3>
                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 border shadow-2xs ${
                  resolvedUploadTarget.type === 'folder'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}>
                  {resolvedUploadTarget.type === 'folder' ? (
                    <>
                      <FolderOpen className="w-3 h-3 text-blue-600" />
                      <span>Target: 📁 {resolvedUploadTarget.label}</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-3 h-3 text-slate-500" />
                      <span>Target: Foto Langsung</span>
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {resolvedUploadTarget.type === 'folder' ? (
                  <>
                    Upload ke:{' '}
                    <strong className="text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                      📁 {resolvedUploadTarget.label}
                    </strong>{' '}
                    (folder aktif di Google Drive).
                  </>
                ) : (
                  'Pilih satu atau beberapa file foto lepas untuk dimasukkan langsung tanpa subfolder.'
                )}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-slate-500" />
              Pilih Foto Satuan / Tarik ke sini
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              Multi-file didukung
            </span>
          </div>

          {/* Uploading overlay */}
          {uploadProgress.isUploading && (
            <div className="absolute inset-0 bg-white/95 backdrop-blur-xs flex flex-col items-center justify-center p-6 space-y-3 z-20 rounded-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="w-8 h-8 rounded-full border-3 border-slate-200 border-t-blue-600 animate-spin" />
              <div className="text-center space-y-0.5">
                <h4 className="text-xs font-bold text-slate-900">
                  Mengunggah {uploadProgress.uploadedFiles} / {uploadProgress.totalFiles} foto
                </h4>
                <p className="text-[11px] text-slate-500 font-mono truncate max-w-[200px]">
                  {uploadProgress.currentFileName}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* STRUKTUR FOLDER ALBUM (Always visible so users can create and manage folders) */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Struktur Folder Album
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              ({folderStructure.folderList.length} folder terdaftar)
            </span>
          </div>

          {/* EXACT ARRANGEMENT: [ + Buat Folder ] [ Filter Tab ] [ Grup per Folder ] */}
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              onClick={() => {
                setNewFolderNameInput('');
                setCreateFolderError(null);
                setIsCreateFolderModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>+ Buat Folder</span>
            </button>

            <button
              onClick={() => setViewGroupedMode(false)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                !viewGroupedMode
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Filter Tab</span>
            </button>

            <button
              onClick={() => setViewGroupedMode(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewGroupedMode
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Grup per Folder</span>
            </button>
          </div>
        </div>

        {/* Folder Pills Bar (Active when not in grouped mode) */}
        {!viewGroupedMode && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={() => {
                setSelectedFolderFilter('all');
                setSelectedSubfolderFilter('all');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                selectedFolderFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span>Semua Foto</span>
              <span className="text-[10px] opacity-75 font-mono">({activePhotos.length})</span>
            </button>

            {folderStructure.directPhotosCount > 0 && (
              <button
                onClick={() => {
                  setSelectedFolderFilter('__direct__');
                  setExplicitUploadTargetFolder('__direct__');
                  setSelectedSubfolderFilter('all');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  selectedFolderFilter === '__direct__'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Foto Langsung</span>
                <span className="text-[10px] opacity-75 font-mono">({folderStructure.directPhotosCount})</span>
              </button>
            )}

            {folderStructure.folderList.map((f) => {
              const isActive = selectedFolderFilter === f.name;
              return (
                <div key={f.name} className="relative inline-flex items-center group/tab">
                  <button
                    onClick={() => {
                      setSelectedFolderFilter(f.name);
                      setExplicitUploadTargetFolder(f.name);
                      setSelectedSubfolderFilter('all');
                    }}
                    className={`pl-3 pr-2 py-1.5 rounded-l-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-y border-l border-blue-200'
                    }`}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>{f.name}</span>
                    <span className="text-[10px] font-mono opacity-80">({f.count})</span>
                  </button>

                  {/* Menu ⋮ on folder tab */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveFolderMenu(activeFolderMenu === f.name ? null : f.name);
                    }}
                    className={`px-1.5 py-1.5 rounded-r-xl text-xs font-bold transition cursor-pointer border-y border-r flex items-center justify-center ${
                      isActive
                        ? 'bg-blue-700 text-white border-blue-600 hover:bg-blue-800'
                        : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-200'
                    }`}
                    title="Menu Folder"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>

                  {/* Dropdown Menu for Folder */}
                  {activeFolderMenu === f.name && (
                    <div
                      className="absolute top-full left-0 mt-1.5 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 text-xs text-slate-700 font-semibold"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          setSelectedFolderFilter(f.name);
                          setExplicitUploadTargetFolder(f.name);
                          setSelectedSubfolderFilter('all');
                          setActiveFolderMenu(null);
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-800"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
                        <span>Buka Folder</span>
                      </button>
                      <button
                        onClick={() => {
                          setRenameModalFolder(f.name);
                          setRenameInputValue(f.name);
                          setActiveFolderMenu(null);
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-800"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                        <span>Rename Folder</span>
                      </button>
                      <button
                        onClick={() => {
                          setDeleteFolderTarget(f.name);
                          setActiveFolderMenu(null);
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-rose-50 flex items-center gap-2 text-rose-600 border-t border-slate-100 mt-1 pt-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Hapus Folder</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Subfolder Pills if active folder has subfolders */}
        {!viewGroupedMode && selectedFolderFilter !== 'all' && selectedFolderFilter !== '__direct__' && (() => {
          const currentF = folderStructure.folderList.find((f) => f.name === selectedFolderFilter);
          if (currentF && currentF.subfolders.length > 0) {
            return (
              <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Subfolder:</span>
                <button
                  onClick={() => setSelectedSubfolderFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    selectedSubfolderFilter === 'all'
                      ? 'bg-blue-100 text-blue-800 font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Semua Subfolder
                </button>
                {currentF.subfolders.map((sub) => (
                  <button
                    key={sub}
                    onClick={() => setSelectedSubfolderFilter(sub)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      selectedSubfolderFilter === sub
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            );
          }
          return null;
        })()}
      </div>

      {/* Photo Toolbar & Management */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            onClick={selectAllPhotos}
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 transition cursor-pointer"
          >
            {selectedPhotoIds.length === displayedPhotos.length && displayedPhotos.length > 0
              ? 'Batal Pilih Semua'
              : `Pilih Semua (${displayedPhotos.length})`}
          </button>

          {selectedPhotoIds.length > 0 && (
            <span className="text-xs font-bold text-slate-900">
              {selectedPhotoIds.length} foto dipilih
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* EXACT ARRANGEMENT: [ Pindahkan ke Folder (N) ] [ Hapus (N) ] [ Download ZIP Terpilih (N) ] */}
          {selectedPhotoIds.length > 0 && (
            <>
              <button
                onClick={() => {
                  setTargetMoveFolderName(
                    selectedFolderFilter !== 'all' && selectedFolderFilter !== '__direct__'
                      ? selectedFolderFilter
                      : (folderStructure.folderList[0]?.name || '')
                  );
                  setIsInlineCreateInMove(false);
                  setMoveStep('select');
                  setIsMovePhotosModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold hover:bg-blue-100 transition cursor-pointer shadow-2xs"
              >
                <FolderInput className="w-3.5 h-3.5 text-blue-600" />
                <span>Pindahkan ke Folder {selectedPhotoIds.length > 1 ? `(${selectedPhotoIds.length})` : ''}</span>
              </button>

              <button
                onClick={handleBatchDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold hover:bg-rose-100 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus ({selectedPhotoIds.length})</span>
              </button>
            </>
          )}

          <button
            onClick={handleDownloadZip}
            disabled={isZipping || activePhotos.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-800 border border-slate-200 text-xs font-semibold hover:bg-slate-200 transition disabled:opacity-50 cursor-pointer"
          >
            <FileArchive className="w-3.5 h-3.5 text-slate-700" />
            <span>
              {isZipping 
                ? 'Mengompres ZIP...' 
                : selectedPhotoIds.length > 0 
                ? `Download ZIP Terpilih (${selectedPhotoIds.length})` 
                : 'Download Semua ZIP (Struktur Folder)'}
            </span>
          </button>
        </div>
      </div>

      {/* Photos Grid or Grouped Sections */}
      {activePhotos.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3 shadow-2xs">
          <ImageIcon className="w-12 h-12 mx-auto text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900">Album Masih Kosong</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Unggah folder foto atau foto satuan melalui area di atas untuk mulai membagikan hasil karya Anda kepada klien.
          </p>
        </div>
      ) : viewGroupedMode ? (
        /* GROUPED SECTIONS VIEW */
        <div className="space-y-6">
          {groupedSections.map((group) => (
            <div key={group.folderName} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <FolderOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {group.folderName}
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      {group.photos.length} Foto
                    </span>
                  </div>
                </div>
              </div>

              {group.photos.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-500 font-medium">Folder ini masih kosong. Anda dapat mengunggah atau memindahkan foto ke folder ini.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                  {group.photos.map((photo) => {
                    const isSelected = selectedPhotoIds.includes(photo.id);
                    const formattedSize = formatPhotoSize(photo.fileSize);
                    const metaString = formatPhotoMeta(photo);

                    return (
                      <div
                        key={photo.id}
                        onClick={() => toggleSelectPhoto(photo.id)}
                        className={`group relative aspect-square rounded-xl overflow-hidden bg-slate-100 border transition cursor-pointer shadow-2xs ${
                          isSelected
                            ? 'border-blue-600 ring-2 ring-blue-500/30'
                            : 'border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        <img
                          src={photo.thumbnailUrl}
                          alt={photo.filename}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />

                        {/* Folder & Subfolder Badge */}
                        {photo.subfolder && (
                          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-slate-900/80 backdrop-blur-xs text-[10px] text-white font-medium shadow-xs">
                            {photo.subfolder}
                          </div>
                        )}

                        {/* Selection indicator */}
                        <div
                          className={`absolute top-2 left-2 w-5 h-5 rounded-md flex items-center justify-center transition ${
                            isSelected
                              ? 'bg-blue-600 text-white font-bold'
                              : 'bg-white/80 text-transparent group-hover:text-slate-600 border border-slate-300'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </div>

                        {/* File Size Badge (always visible on thumbnail, bottom-right) */}
                        {formattedSize && (
                          <div className="absolute bottom-2 right-2 z-10 pointer-events-none transition-opacity duration-200 group-hover:opacity-0">
                            <span className="px-1.5 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-xs border border-white/10 text-[10px] font-mono font-medium text-white shadow-xs">
                              {formattedSize}
                            </span>
                          </div>
                        )}

                        {/* Quick actions overlay */}
                        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-slate-950/85 via-slate-950/50 to-transparent opacity-0 group-hover:opacity-100 transition flex items-end justify-between gap-1.5">
                          <div className="text-white space-y-0.5 max-w-[65%] truncate">
                            <p className="text-[10px] text-white truncate font-mono font-semibold">
                              {photo.filename}
                            </p>
                            <span className="text-[9px] text-slate-300 font-mono block truncate">
                              {metaString || formattedSize}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setPreviewPhoto(photo)}
                              className="p-1 rounded bg-white/90 text-slate-900 hover:bg-white transition cursor-pointer"
                              title="Lihat Pratinjau Foto"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeletePhoto(photo.id)}
                              className="p-1 rounded bg-rose-600 text-white hover:bg-rose-700 transition cursor-pointer"
                              title="Hapus Foto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* STANDARD FILTERED GRID */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {displayedPhotos.map((photo) => {
            const isSelected = selectedPhotoIds.includes(photo.id);
            const formattedSize = formatPhotoSize(photo.fileSize);
            const metaString = formatPhotoMeta(photo);

            return (
              <div
                key={photo.id}
                onClick={() => toggleSelectPhoto(photo.id)}
                className={`group relative aspect-square rounded-xl overflow-hidden bg-slate-100 border transition cursor-pointer shadow-2xs ${
                  isSelected
                    ? 'border-blue-600 ring-2 ring-blue-500/30'
                    : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                <img
                  src={photo.thumbnailUrl}
                  alt={photo.filename}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />

                {/* Folder Path Badge */}
                {photo.folderPath && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-xs text-[10px] text-white font-medium max-w-[120px] truncate shadow-xs">
                    📁 {photo.folderPath}
                  </div>
                )}

                {/* Selection indicator */}
                <div
                  className={`absolute top-2 left-2 w-5 h-5 rounded-md flex items-center justify-center transition ${
                    isSelected
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-white/80 text-transparent group-hover:text-slate-600 border border-slate-300'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                </div>

                {/* File Size Badge (always visible on thumbnail, bottom-right) */}
                {formattedSize && (
                  <div className="absolute bottom-2 right-2 z-10 pointer-events-none transition-opacity duration-200 group-hover:opacity-0">
                    <span className="px-1.5 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-xs border border-white/10 text-[10px] font-mono font-medium text-white shadow-xs">
                      {formattedSize}
                    </span>
                  </div>
                )}

                {/* Quick actions overlay */}
                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-slate-950/85 via-slate-950/50 to-transparent opacity-0 group-hover:opacity-100 transition flex items-end justify-between gap-1.5">
                  <div className="text-white space-y-0.5 max-w-[65%] truncate">
                    <p className="text-[10px] text-white truncate font-mono font-semibold">
                      {photo.filename}
                    </p>
                    <span className="text-[9px] text-slate-300 font-mono block truncate">
                      {metaString || formattedSize}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setPreviewPhoto(photo)}
                      className="p-1 rounded bg-white/90 text-slate-900 hover:bg-white transition cursor-pointer"
                      title="Lihat Pratinjau Foto"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeletePhoto(photo.id)}
                      className="p-1 rounded bg-rose-600 text-white hover:bg-rose-700 transition cursor-pointer"
                      title="Hapus Foto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DIALOG 1: BUAT FOLDER BARU                                   */}
      {/* ------------------------------------------------------------- */}
      {isCreateFolderModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Buat Folder Baru</h3>
                  <p className="text-xs text-slate-500">Folder akan dibuat langsung di Google Drive</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateFolderModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Folder
                </label>
                <input
                  type="text"
                  value={newFolderNameInput}
                  onChange={(e) => {
                    setNewFolderNameInput(e.target.value);
                    setCreateFolderError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateFolderSubmit();
                    }
                  }}
                  placeholder="Masukkan nama folder (contoh: Keluarga, Akad, dll)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  autoFocus
                />
                {createFolderError && (
                  <p className="text-xs text-rose-600 font-semibold mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{createFolderError}</span>
                  </p>
                )}
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Lokasi:</span>
                <span className="font-bold text-slate-900 truncate max-w-[240px]">
                  Album: {localAlbum.eventName}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreateFolderModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isCreatingFolder || !newFolderNameInput.trim()}
                onClick={handleCreateFolderSubmit}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                {isCreatingFolder ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Membuat di Google Drive...</span>
                  </>
                ) : (
                  <>
                    <FolderPlus className="w-4 h-4" />
                    <span>Buat Folder</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DIALOG 2: PINDAHKAN FOTO KE FOLDER                           */}
      {/* ------------------------------------------------------------- */}
      {isMovePhotosModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <FolderInput className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Pindahkan Foto</h3>
                  <p className="text-xs font-semibold text-blue-600">
                    {selectedPhotoIds.length} foto dipilih
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isMovingPhotos) {
                    setIsMovePhotosModalOpen(false);
                  }
                }}
                disabled={isMovingPhotos}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {moveStep === 'progress' ? (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Memindahkan File di Google Drive...
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Memperbarui direktori fisik Google Drive & metadata sistem
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Pilih Folder Tujuan:
                  </label>

                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                    {/* Option: Foto Langsung (Tanpa Folder) */}
                    <label
                      onClick={() => setTargetMoveFolderName('')}
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                        targetMoveFolderName === ''
                          ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <ImageIcon className="w-4 h-4 text-slate-500" />
                        <span>Foto Langsung (Tanpa Folder)</span>
                      </div>
                      <input
                        type="radio"
                        name="targetFolder"
                        checked={targetMoveFolderName === ''}
                        onChange={() => setTargetMoveFolderName('')}
                        className="w-4 h-4 text-blue-600"
                      />
                    </label>

                    {/* Options: All registered folders */}
                    {folderStructure.folderList.map((f) => (
                      <label
                        key={f.name}
                        onClick={() => setTargetMoveFolderName(f.name)}
                        className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                          targetMoveFolderName === f.name
                            ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Folder className="w-4 h-4 text-blue-600" />
                          <span>{f.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({f.count} foto)</span>
                        </div>
                        <input
                          type="radio"
                          name="targetFolder"
                          checked={targetMoveFolderName === f.name}
                          onChange={() => setTargetMoveFolderName(f.name)}
                          className="w-4 h-4 text-blue-600"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {/* Inline + Buat Folder Baru */}
                {isInlineCreateInMove ? (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase">
                      Nama Folder Baru
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={inlineFolderNameInMove}
                        onChange={(e) => setInlineFolderNameInMove(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreateInlineFolderInMove();
                          }
                        }}
                        placeholder="Ketik nama folder..."
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleCreateInlineFolderInMove}
                        disabled={isCreatingInlineFolder || !inlineFolderNameInMove.trim()}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                      >
                        {isCreatingInlineFolder ? '...' : 'Buat'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsInlineCreateInMove(false)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg text-xs"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsInlineCreateInMove(true)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-blue-50 transition cursor-pointer"
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span>+ Buat Folder Baru</span>
                  </button>
                )}

                {/* Confirmation Box */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                  <span>Konfirmasi: Pindahkan <strong>{selectedPhotoIds.length} foto</strong> ke{' '}
                    <strong className="text-blue-700 font-bold">
                      {targetMoveFolderName ? `"${targetMoveFolderName}"` : 'Foto Langsung'}
                    </strong>?
                  </span>
                </div>
              </div>
            )}

            {moveStep !== 'progress' && (
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMovePhotosModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleExecuteMovePhotos}
                  disabled={isMovingPhotos}
                  className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  <FolderInput className="w-4 h-4" />
                  <span>Pindahkan {selectedPhotoIds.length} Foto</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DIALOG 3: RENAME FOLDER                                       */}
      {/* ------------------------------------------------------------- */}
      {renameModalFolder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Rename Folder</h3>
                  <p className="text-xs text-slate-500">Ubah nama folder di Google Drive & Galeri</p>
                </div>
              </div>
              <button
                onClick={() => setRenameModalFolder(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Folder Baru
                </label>
                <input
                  type="text"
                  value={renameInputValue}
                  onChange={(e) => setRenameInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleRenameFolderSubmit();
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRenameModalFolder(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isRenamingFolder || !renameInputValue.trim()}
                onClick={handleRenameFolderSubmit}
                className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                {isRenamingFolder ? 'Menyimpan...' : 'Simpan Nama'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DIALOG 4: HAPUS FOLDER                                        */}
      {/* ------------------------------------------------------------- */}
      {deleteFolderTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Hapus Folder</h3>
                  <p className="text-xs text-slate-500">Folder: "{deleteFolderTarget}"</p>
                </div>
              </div>
              <button
                onClick={() => setDeleteFolderTarget(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Bagaimana Anda ingin menangani foto-foto di dalam folder <strong>"{deleteFolderTarget}"</strong>?
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleDeleteFolderSubmit(false)}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition cursor-pointer"
              >
                <p className="text-xs font-bold text-slate-900">Pindahkan Foto ke "Foto Langsung"</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Hapus folder saja, pertahankan semua foto di dalam album.</p>
              </button>

              <button
                type="button"
                onClick={() => handleDeleteFolderSubmit(true)}
                className="w-full p-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-left transition cursor-pointer"
              >
                <p className="text-xs font-bold text-rose-700">Hapus Folder Sekaligus Semua Fotonya</p>
                <p className="text-[11px] text-rose-600 mt-0.5">Pindahkan semua foto di folder ini ke tempat Sampah.</p>
              </button>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteFolderTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Fullscreen preview */}
      {previewPhoto && (
        <div 
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <button
            onClick={() => setPreviewPhoto(null)}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="max-w-4xl max-h-[85vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewPhoto.previewUrl || previewPhoto.thumbnailUrl}
              alt={previewPhoto.filename}
              className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl"
              referrerPolicy="no-referrer"
            />
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5 text-xs text-slate-300">
              <span className="font-mono text-white font-semibold">{previewPhoto.filename}</span>
              {formatPhotoMeta(previewPhoto) && (
                <span className="px-2.5 py-1 rounded-md bg-slate-800/90 text-slate-200 font-mono text-xs border border-white/10">
                  {formatPhotoMeta(previewPhoto)}
                </span>
              )}
              {previewPhoto.folderPath && (
                <span className="px-2 py-1 bg-slate-800 rounded-md text-slate-400 font-mono text-xs border border-white/5">
                  📁 {previewPhoto.folderPath}
                </span>
              )}
              <button
                type="button"
                onClick={() => downloadOriginalPhotoFile(previewPhoto, localAlbum.id)}
                className="px-3.5 py-1.5 rounded-lg bg-white text-slate-900 font-bold flex items-center gap-1.5 hover:bg-slate-100 transition shadow cursor-pointer text-xs"
              >
                <Download className="w-3.5 h-3.5" /> Download Asli
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
