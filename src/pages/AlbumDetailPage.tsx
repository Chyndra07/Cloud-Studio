import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Upload,
  QrCode,
  Copy,
  ExternalLink,
  Download,
  Trash2,
  Image as ImageIcon,
  Heart,
  FileText,
  Shield,
  Calendar,
  Clock,
  HardDrive,
  CheckCircle,
  Share2,
  RefreshCw,
  Eye,
  Star,
  Folder,
  FolderPlus,
  FolderTree,
  ChevronRight,
  MoreVertical,
  CheckSquare,
  Square,
  Edit2,
  ArrowRight,
  CornerDownRight,
  X,
  AlertCircle,
} from 'lucide-react';
import { Album, PhotoItem, AlbumFolder, StudioProfile, ClientSelection } from '../types';
import { PhotoUploader } from '../components/upload/PhotoUploader';
import { Modal } from '../components/common/Modal';
import {
  listAllAlbumFoldersAndPhotos,
  createDriveSubfolder,
  renameDriveItem,
  moveDriveFile,
  copyDriveFile,
  deleteDriveFolder,
  deleteDrivePhoto,
} from '../services/googleDriveService';
import { getPublicGalleryUrl } from '../config/appConfig';
import { downloadSinglePhoto, downloadPhotosAsZip } from '../services/downloadService';
import { getClientSelection } from '../services/dbService';
import { FolderCard } from '../components/albums/FolderCard';
import { CreateFolderModal } from '../components/albums/CreateFolderModal';
import { RenameItemModal } from '../components/albums/RenameItemModal';
import { MoveCopyModal } from '../components/albums/MoveCopyModal';

interface AlbumDetailPageProps {
  album: Album;
  accessToken: string;
  studioProfile: StudioProfile | null;
  onBack: () => void;
  onOpenQR: (album: Album) => void;
  onUpdateAlbum: (updated: Album) => Promise<void>;
  onTrashAlbum: (albumId: string) => void;
}

export const AlbumDetailPage: React.FC<AlbumDetailPageProps> = ({
  album,
  accessToken,
  studioProfile,
  onBack,
  onOpenQR,
  onUpdateAlbum,
  onTrashAlbum,
}) => {
  const [activeTab, setActiveTab] = useState<'photos' | 'folders' | 'selections'>('photos');
  const [photos, setPhotos] = useState<PhotoItem[]>(album.photos || []);
  const [folders, setFolders] = useState<AlbumFolder[]>(album.folders || []);
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [uploadTargetFolderId, setUploadTargetFolderId] = useState<string>(album.driveFolderId);
  const [clientSelection, setClientSelection] = useState<ClientSelection | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);

  // Folder Browsing State
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // Multi-Selection State for Bulk Actions
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [activePhotoMenuId, setActivePhotoMenuId] = useState<string | null>(null);

  // Modals State
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState<boolean>(false);
  const [renameModal, setRenameModal] = useState<{
    isOpen: boolean;
    title: string;
    initialName: string;
    itemId: string;
    type: 'folder' | 'photo';
  }>({
    isOpen: false,
    title: '',
    initialName: '',
    itemId: '',
    type: 'folder',
  });
  const [moveCopyModal, setMoveCopyModal] = useState<{
    isOpen: boolean;
    mode: 'move' | 'copy';
    targetPhotoIds: string[];
    currentFolderId?: string;
  }>({
    isOpen: false,
    mode: 'move',
    targetPhotoIds: [],
  });

  // Action feedback alert
  const [actionNotice, setActionNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Lightbox Preview
  const [previewPhoto, setPreviewPhoto] = useState<PhotoItem | null>(null);

  // Zip Progress State
  const [zipProgress, setZipProgress] = useState<{ active: boolean; percent: number; text: string }>({
    active: false,
    percent: 0,
    text: '',
  });

  const showNotice = (message: string, type: 'success' | 'error' = 'success') => {
    setActionNotice({ message, type });
    setTimeout(() => setActionNotice(null), 3500);
  };

  // Sync all folders & photos from Google Drive
  const loadDriveContent = async () => {
    if (!accessToken || !album.driveFolderId) return;
    setIsLoadingContent(true);
    try {
      const { photos: drivePhotos, folders: driveFolders } = await listAllAlbumFoldersAndPhotos(
        accessToken,
        album.driveFolderId
      );
      setPhotos(drivePhotos);
      setFolders(driveFolders);

      const updatedAlbum: Album = {
        ...album,
        photos: drivePhotos,
        folders: driveFolders,
        photoCount: drivePhotos.length,
        coverPhotoUrl: album.coverPhotoUrl || drivePhotos[0]?.thumbnailUrl,
        updatedAt: new Date().toISOString(),
      };
      await onUpdateAlbum(updatedAlbum);
    } catch (err: any) {
      console.warn('[ALBUM_DETAIL] Failed to sync Drive content:', err);
      showNotice(err?.message || 'Gagal menyinkronkan konten dari Google Drive', 'error');
    } finally {
      setIsLoadingContent(false);
    }
  };

  // Load client selections & notes
  const loadSelections = async () => {
    try {
      const sel = await getClientSelection(album.galleryId);
      setClientSelection(sel);
    } catch (err) {
      console.warn('[ALBUM_DETAIL] Selections load error:', err);
    }
  };

  useEffect(() => {
    loadDriveContent();
    loadSelections();
  }, [album.albumId, album.driveFolderId]);

  // When files uploaded via PhotoUploader
  const handlePhotosUploaded = async (newPhotos: PhotoItem[]) => {
    const combined = [...photos, ...newPhotos];
    const unique = Array.from(new Map(combined.map((item) => [item.driveFileId, item])).values());
    setPhotos(unique);

    const updatedAlbum: Album = {
      ...album,
      photos: unique,
      folders: folders,
      photoCount: unique.length,
      coverPhotoUrl: album.coverPhotoUrl || unique[0]?.thumbnailUrl,
      updatedAt: new Date().toISOString(),
    };
    await onUpdateAlbum(updatedAlbum);
    setIsUploadModalOpen(false);
    showNotice(`${newPhotos.length} foto berhasil diunggah.`);
  };

  // 1. Create New Folder / Subfolder
  const handleCreateFolder = async (folderName: string) => {
    const parentId = currentFolderId || album.driveFolderId;
    const newFolder = await createDriveSubfolder(accessToken, parentId, folderName);
    const parentFolder = folders.find((f) => f.id === parentId);
    newFolder.path = parentFolder ? `${parentFolder.path || parentFolder.name}/${newFolder.name}` : newFolder.name;

    const updatedFolders = [...folders, newFolder];
    setFolders(updatedFolders);

    const updatedAlbum: Album = {
      ...album,
      folders: updatedFolders,
      updatedAt: new Date().toISOString(),
    };
    await onUpdateAlbum(updatedAlbum);
    showNotice(`Folder "${folderName}" berhasil dibuat di Google Drive.`);
  };

  // 2. Rename Folder / Photo
  const handleRenameSubmit = async (newName: string) => {
    if (renameModal.type === 'folder') {
      await renameDriveItem(accessToken, renameModal.itemId, newName);
      const updatedFolders = folders.map((f) =>
        f.id === renameModal.itemId ? { ...f, name: newName } : f
      );
      setFolders(updatedFolders);
      await onUpdateAlbum({ ...album, folders: updatedFolders, updatedAt: new Date().toISOString() });
      showNotice(`Nama folder berhasil diubah menjadi "${newName}".`);
    } else {
      await renameDriveItem(accessToken, renameModal.itemId, newName);
      const updatedPhotos = photos.map((p) =>
        p.driveFileId === renameModal.itemId ? { ...p, name: newName } : p
      );
      setPhotos(updatedPhotos);
      await onUpdateAlbum({ ...album, photos: updatedPhotos, updatedAt: new Date().toISOString() });
      showNotice(`Nama foto berhasil diubah menjadi "${newName}".`);
    }
  };

  // 3. Delete Folder
  const handleDeleteFolder = async (folder: AlbumFolder) => {
    if (!confirm(`Hapus folder "${folder.name}" beserta seluruh isinya dari Google Drive?`)) return;
    try {
      await deleteDriveFolder(accessToken, folder.id);
      const updatedFolders = folders.filter((f) => f.id !== folder.id && f.parentId !== folder.id);
      const updatedPhotos = photos.filter((p) => p.folderId !== folder.id);
      setFolders(updatedFolders);
      setPhotos(updatedPhotos);

      await onUpdateAlbum({
        ...album,
        folders: updatedFolders,
        photos: updatedPhotos,
        photoCount: updatedPhotos.length,
        updatedAt: new Date().toISOString(),
      });

      if (currentFolderId === folder.id) {
        setCurrentFolderId(folder.parentId || null);
      }
      showNotice(`Folder "${folder.name}" berhasil dihapus.`);
    } catch (err: any) {
      showNotice(err?.message || 'Gagal menghapus folder.', 'error');
    }
  };

  // 4. Move Photos (Single / Bulk)
  const handleMovePhotos = async (targetFolderId: string, photoIdsToMove: string[]) => {
    try {
      for (const pId of photoIdsToMove) {
        const photo = photos.find((p) => p.driveFileId === pId);
        if (!photo) continue;
        const oldParent = photo.folderId || album.driveFolderId;
        if (oldParent === targetFolderId) continue;
        await moveDriveFile(accessToken, pId, oldParent, targetFolderId);
      }

      const targetFolder = folders.find((f) => f.id === targetFolderId);
      const targetName = targetFolder ? targetFolder.path || targetFolder.name : '';

      const updatedPhotos = photos.map((p) => {
        if (photoIdsToMove.includes(p.driveFileId)) {
          return {
            ...p,
            folderId: targetFolderId === album.driveFolderId ? undefined : targetFolderId,
            parentFolderId: targetFolderId,
            folderName: targetName,
          };
        }
        return p;
      });

      setPhotos(updatedPhotos);
      setSelectedPhotoIds([]);

      // Recalculate folder photo counts
      const updatedFolders = folders.map((f) => {
        const count = updatedPhotos.filter(
          (p) => p.folderId === f.id || (p.folderName && p.folderName.startsWith(f.name))
        ).length;
        return { ...f, photoCount: count };
      });
      setFolders(updatedFolders);

      await onUpdateAlbum({
        ...album,
        photos: updatedPhotos,
        folders: updatedFolders,
        updatedAt: new Date().toISOString(),
      });

      showNotice(
        `${photoIdsToMove.length} foto berhasil dipindahkan ke ${
          targetFolder ? targetFolder.name : 'Direktori Utama'
        }.`
      );
    } catch (err: any) {
      showNotice(err?.message || 'Gagal memindahkan foto.', 'error');
    }
  };

  // 5. Copy Photos (Single / Bulk)
  const handleCopyPhotos = async (targetFolderId: string, photoIdsToCopy: string[]) => {
    try {
      const newCopies: PhotoItem[] = [];
      const targetFolder = folders.find((f) => f.id === targetFolderId);
      const targetName = targetFolder ? targetFolder.path || targetFolder.name : '';

      for (const pId of photoIdsToCopy) {
        const photo = photos.find((p) => p.driveFileId === pId);
        if (!photo) continue;
        const copyName = `Salinan_${photo.name}`;
        const copied = await copyDriveFile(accessToken, pId, targetFolderId, copyName);
        copied.folderId = targetFolderId === album.driveFolderId ? undefined : targetFolderId;
        copied.folderName = targetName;
        newCopies.push(copied);
      }

      const updatedPhotos = [...photos, ...newCopies];
      setPhotos(updatedPhotos);
      setSelectedPhotoIds([]);

      const updatedFolders = folders.map((f) => {
        const count = updatedPhotos.filter(
          (p) => p.folderId === f.id || (p.folderName && p.folderName.startsWith(f.name))
        ).length;
        return { ...f, photoCount: count };
      });
      setFolders(updatedFolders);

      await onUpdateAlbum({
        ...album,
        photos: updatedPhotos,
        folders: updatedFolders,
        photoCount: updatedPhotos.length,
        updatedAt: new Date().toISOString(),
      });

      showNotice(`${newCopies.length} foto berhasil disalin ke folder tujuan.`);
    } catch (err: any) {
      showNotice(err?.message || 'Gagal menyalin foto.', 'error');
    }
  };

  // 6. Delete Single Photo
  const handleDeletePhoto = async (photo: PhotoItem) => {
    if (!confirm(`Hapus foto "${photo.name}" dari Google Drive dan album?`)) return;
    try {
      await deleteDrivePhoto(accessToken, photo.driveFileId);
      const remaining = photos.filter((p) => p.driveFileId !== photo.driveFileId);
      setPhotos(remaining);

      const updatedAlbum: Album = {
        ...album,
        photos: remaining,
        folders: folders,
        photoCount: remaining.length,
        coverPhotoUrl:
          album.coverPhotoUrl === photo.thumbnailUrl ? remaining[0]?.thumbnailUrl || '' : album.coverPhotoUrl,
        updatedAt: new Date().toISOString(),
      };
      await onUpdateAlbum(updatedAlbum);
      showNotice(`Foto "${photo.name}" berhasil dihapus.`);
    } catch (err: any) {
      showNotice(err.message || 'Gagal menghapus foto.', 'error');
    }
  };

  // 7. Bulk Delete Photos
  const handleBulkDeletePhotos = async () => {
    if (selectedPhotoIds.length === 0) return;
    if (!confirm(`Hapus ${selectedPhotoIds.length} foto terpilih dari Google Drive dan album?`)) return;

    try {
      for (const pId of selectedPhotoIds) {
        await deleteDrivePhoto(accessToken, pId).catch(() => {});
      }
      const remaining = photos.filter((p) => !selectedPhotoIds.includes(p.driveFileId));
      setPhotos(remaining);
      setSelectedPhotoIds([]);

      const updatedAlbum: Album = {
        ...album,
        photos: remaining,
        folders: folders,
        photoCount: remaining.length,
        coverPhotoUrl: remaining[0]?.thumbnailUrl || '',
        updatedAt: new Date().toISOString(),
      };
      await onUpdateAlbum(updatedAlbum);
      showNotice(`${selectedPhotoIds.length} foto berhasil dihapus.`);
    } catch (err: any) {
      showNotice(err?.message || 'Gagal menghapus beberapa foto.', 'error');
    }
  };

  const handleSetCoverPhoto = async (photo: PhotoItem) => {
    const updatedAlbum: Album = {
      ...album,
      coverPhotoUrl: photo.thumbnailUrl || photo.webViewLink,
      updatedAt: new Date().toISOString(),
    };
    await onUpdateAlbum(updatedAlbum);
    showNotice('Foto sampul album berhasil diperbarui!');
  };

  const handleDownloadAllZip = async () => {
    if (photos.length === 0) {
      alert('Tidak ada foto untuk diunduh.');
      return;
    }

    setZipProgress({ active: true, percent: 5, text: 'Menyiapkan unduhan semua foto...' });
    try {
      await downloadPhotosAsZip(
        photos,
        `${album.albumName.replace(/\s+/g, '_')}_Original.zip`,
        (percent, text) => {
          setZipProgress({ active: true, percent, text });
        }
      );
      setTimeout(() => setZipProgress({ active: false, percent: 0, text: '' }), 1500);
    } catch (err: any) {
      alert(err.message || 'Gagal mengunduh ZIP.');
      setZipProgress({ active: false, percent: 0, text: '' });
    }
  };

  const handleCopyPublicUrl = () => {
    const url = getPublicGalleryUrl(album.galleryId);
    navigator.clipboard.writeText(url);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  // Photo Selection Toggles
  const handleToggleSelectPhoto = (photoId: string) => {
    setSelectedPhotoIds((prev) =>
      prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId]
    );
  };

  const handleSelectAllCurrentPhotos = (targetPhotos: PhotoItem[]) => {
    const allIds = targetPhotos.map((p) => p.driveFileId);
    const areAllSelected = allIds.every((id) => selectedPhotoIds.includes(id));
    if (areAllSelected) {
      setSelectedPhotoIds((prev) => prev.filter((id) => !allIds.includes(id)));
    } else {
      setSelectedPhotoIds((prev) => Array.from(new Set([...prev, ...allIds])));
    }
  };

  // Filter photos and subfolders based on current folder in "folders" tab
  const currentLevelFolders = folders.filter((f) =>
    currentFolderId ? f.parentId === currentFolderId : !f.parentId || f.parentId === album.driveFolderId
  );

  const currentLevelPhotos = photos.filter((p) =>
    currentFolderId
      ? p.folderId === currentFolderId
      : !p.folderId || p.folderId === album.driveFolderId
  );

  // Active folder details for breadcrumb
  const currentFolderObj = currentFolderId ? folders.find((f) => f.id === currentFolderId) : null;

  // Selected Photos in Client Selection
  const selectedPhotosList = photos.filter((p) =>
    clientSelection?.selectedPhotoIds.includes(p.driveFileId)
  );

  return (
    <div className="space-y-6 pb-24">
      {/* Top Action Notification Banner */}
      {actionNotice && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-sm animate-fade-in ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{actionNotice.message}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="p-1 hover:opacity-70">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Daftar Album</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenQR(album)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-all shadow-xs"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Lihat QR Code</span>
          </button>

          <button
            onClick={handleCopyPublicUrl}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-all shadow-xs"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copyFeedback ? '✓ Tautan Disalin!' : 'Salin Tautan Galeri'}</span>
          </button>

          <a
            href={getPublicGalleryUrl(album.galleryId)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold transition-all shadow-xs"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Buka Galeri Publik</span>
          </a>
        </div>
      </div>

      {/* Album Header Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{album.albumName}</h1>
            <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2.5 py-1 rounded-lg">
              ID: {album.galleryId}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
            <span>
              👤 Pelanggan: <strong className="text-slate-800">{album.clientName}</strong>
            </span>
            {album.eventDate && (
              <span>
                📅 Acara: <strong className="text-slate-800">{album.eventDate}</strong>
              </span>
            )}
            {album.isPinEnabled && album.pin && (
              <span className="flex items-center gap-1 text-amber-700 font-mono font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                <Shield className="w-3 h-3 text-amber-600" /> PIN: {album.pin}
              </span>
            )}
            <span className="flex items-center gap-1 text-blue-700 font-semibold">
              <HardDrive className="w-3.5 h-3.5" /> Google Drive Terhubung
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 self-stretch md:self-auto">
          <button
            onClick={() => {
              setUploadTargetFolderId(currentFolderId || album.driveFolderId);
              setIsUploadModalOpen(true);
            }}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all"
          >
            <Upload className="w-4 h-4" />
            + Unggah Foto Asli
          </button>

          <button
            onClick={handleDownloadAllZip}
            disabled={photos.length === 0 || zipProgress.active}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 rounded-xl text-xs font-bold transition-all"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download Semua (ZIP)</span>
          </button>
        </div>
      </div>

      {/* ZIP Progress Bar Alert */}
      {zipProgress.active && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-blue-900">
            <span>{zipProgress.text}</span>
            <span>{zipProgress.percent}%</span>
          </div>
          <div className="w-full bg-blue-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-300 rounded-full"
              style={{ width: `${zipProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Segmented Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('photos')}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'photos'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          Semua Foto ({photos.length})
        </button>

        <button
          onClick={() => setActiveTab('folders')}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'folders'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Folder className="w-4 h-4 text-amber-500" />
          Struktur Folder ({folders.length})
        </button>

        <button
          onClick={() => setActiveTab('selections')}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'selections'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Heart className="w-4 h-4 text-rose-500" />
          Pilihan & Catatan Pelanggan ({clientSelection?.selectedPhotoIds.length || 0})
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: SEMUA FOTO (FLAT VIEW) */}
      {/* ======================================================== */}
      {activeTab === 'photos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectAllCurrentPhotos(photos)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all"
              >
                {photos.length > 0 && photos.every((p) => selectedPhotoIds.includes(p.driveFileId)) ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                    <span>Batalkan Pilih Semua</span>
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                    <span>Pilih Semua Foto</span>
                  </>
                )}
              </button>

              <span className="text-xs text-slate-500">
                {selectedPhotoIds.length > 0 ? `${selectedPhotoIds.length} foto dipilih` : `${photos.length} total foto`}
              </span>
            </div>

            <button
              onClick={loadDriveContent}
              disabled={isLoadingContent}
              className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-blue-600"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingContent ? 'animate-spin' : ''}`} />
              Segarkan Konten dari Drive
            </button>
          </div>

          {photos.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white border-2 border-dashed border-slate-200 rounded-3xl">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Upload className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-slate-800">Belum Ada Foto di Album Ini</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
                Unggah foto hasil pemotretan ke album ini. Format foto asli akan dipertahankan sepenuhnya.
              </p>
              <button
                onClick={() => {
                  setUploadTargetFolderId(album.driveFolderId);
                  setIsUploadModalOpen(true);
                }}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
              >
                + Unggah Foto Sekarang
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 items-start">
              {photos.map((photo) => {
                const isSelected = selectedPhotoIds.includes(photo.driveFileId);

                return (
                  <div
                    key={photo.driveFileId}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', photo.driveFileId);
                      e.dataTransfer.setData('photoId', photo.driveFileId);
                    }}
                    className={`bg-white border rounded-2xl overflow-hidden shadow-sm group hover:shadow-md transition-all flex flex-col justify-between ${
                      isSelected ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md' : 'border-slate-200'
                    }`}
                  >
                    {/* Image container (9:16 Portrait) */}
                    <div
                      onClick={() => setPreviewPhoto(photo)}
                      className="relative w-full aspect-[9/16] bg-slate-950 overflow-hidden flex items-center justify-center cursor-pointer rounded-t-2xl shrink-0"
                      style={{ aspectRatio: '9 / 16', width: '100%' }}
                    >
                      {/* Ambient blur backdrop */}
                      <img
                        src={photo.thumbnailUrl || photo.webViewLink}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 w-full h-full object-cover opacity-25 filter blur-lg scale-110 pointer-events-none"
                      />
                      {/* 100% Uncropped Photo with object-contain */}
                      <img
                        src={photo.thumbnailUrl || photo.webViewLink}
                        alt={photo.name}
                        loading="lazy"
                        className="relative z-10 max-w-full max-h-full w-full h-full transition-transform duration-300 group-hover:scale-[1.02]"
                        style={{ objectFit: 'contain', objectPosition: 'center center' }}
                      />

                      {/* Select Checkbox */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSelectPhoto(photo.driveFileId);
                        }}
                        className={`absolute top-2 left-2 z-20 p-1.5 rounded-lg shadow-sm transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-black/40 hover:bg-black/60 text-white/80 opacity-0 group-hover:opacity-100'
                        }`}
                        title={isSelected ? 'Batalkan pilihan' : 'Pilih foto ini'}
                      >
                        {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>

                      {/* Folder Name Badge if inside subfolder */}
                      {photo.folderName && (
                        <span className="absolute top-2 right-2 z-10 bg-black/60 backdrop-blur-md text-white text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Folder className="w-2.5 h-2.5 text-amber-400" />
                          <span className="truncate max-w-[80px]">{photo.folderName}</span>
                        </span>
                      )}

                      {/* Cover Photo Badge */}
                      {album.coverPhotoUrl === photo.thumbnailUrl && (
                        <span className="absolute bottom-2 left-2 z-10 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm flex items-center gap-1">
                          <Star className="w-3 h-3 fill-current" /> Sampul
                        </span>
                      )}
                    </div>

                    {/* Details & Actions Footer */}
                    <div className="p-3 bg-white space-y-1.5">
                      <p className="text-xs font-semibold text-slate-800 truncate" title={photo.name}>
                        {photo.name}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>{(photo.size / 1024 / 1024).toFixed(1)} MB</span>

                        {/* Photo 3-Dots Menu */}
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() =>
                              setActivePhotoMenuId(
                                activePhotoMenuId === photo.driveFileId ? null : photo.driveFileId
                              )
                            }
                            className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                            title="Opsi Foto"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {activePhotoMenuId === photo.driveFileId && (
                            <>
                              <div
                                className="fixed inset-0 z-30"
                                onClick={() => setActivePhotoMenuId(null)}
                              />
                              <div className="absolute right-0 bottom-full mb-1 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 py-1 text-xs">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActivePhotoMenuId(null);
                                    setRenameModal({
                                      isOpen: true,
                                      title: 'Ubah Nama File Foto',
                                      initialName: photo.name,
                                      itemId: photo.driveFileId,
                                      type: 'photo',
                                    });
                                  }}
                                  className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-amber-500" />
                                  <span>Ubah Nama File</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActivePhotoMenuId(null);
                                    setMoveCopyModal({
                                      isOpen: true,
                                      mode: 'move',
                                      targetPhotoIds: [photo.driveFileId],
                                      currentFolderId: photo.folderId || album.driveFolderId,
                                    });
                                  }}
                                  className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <FolderTree className="w-3.5 h-3.5 text-blue-500" />
                                  <span>Pindahkan ke Folder</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActivePhotoMenuId(null);
                                    setMoveCopyModal({
                                      isOpen: true,
                                      mode: 'copy',
                                      targetPhotoIds: [photo.driveFileId],
                                      currentFolderId: photo.folderId || album.driveFolderId,
                                    });
                                  }}
                                  className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <Copy className="w-3.5 h-3.5 text-emerald-500" />
                                  <span>Salin ke Folder Lain</span>
                                </button>

                                {photo.folderId && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActivePhotoMenuId(null);
                                      handleMovePhotos(album.driveFolderId, [photo.driveFileId]);
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                  >
                                    <CornerDownRight className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Kembalikan ke Root</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActivePhotoMenuId(null);
                                    handleSetCoverPhoto(photo);
                                  }}
                                  className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <Star className="w-3.5 h-3.5 text-amber-500" />
                                  <span>Jadikan Sampul</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActivePhotoMenuId(null);
                                    downloadSinglePhoto(photo);
                                  }}
                                  className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <Download className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Unduh Foto Asli</span>
                                </button>

                                <div className="my-1 border-t border-slate-100" />

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActivePhotoMenuId(null);
                                    handleDeletePhoto(photo);
                                  }}
                                  className="w-full px-3.5 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Hapus Foto</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: STRUKTUR FOLDER & JELAJAH SUBFOLDER */}
      {/* ======================================================== */}
      {activeTab === 'folders' && (
        <div className="space-y-6">
          {/* Breadcrumb Navigation & Folder Actions Header */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Breadcrumb Path */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <button
                type="button"
                onClick={() => setCurrentFolderId(null)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all ${
                  currentFolderId === null
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Folder className="w-3.5 h-3.5 text-blue-600" />
                <span>{album.albumName} (Root)</span>
              </button>

              {currentFolderObj && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-800 rounded-lg font-bold border border-amber-200/60 flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-amber-600" />
                    <span>{currentFolderObj.name}</span>
                  </span>
                </>
              )}
            </div>

            {/* Folder Header Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCreateFolderOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>+ Buat Folder Baru</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUploadTargetFolderId(currentFolderId || album.driveFolderId);
                  setIsUploadModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all"
              >
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>Unggah ke Folder Ini</span>
              </button>

              <button
                onClick={loadDriveContent}
                disabled={isLoadingContent}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                title="Segarkan Folder"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingContent ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Subfolders Grid */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Folder className="w-4 h-4 text-amber-500" />
              <span>Daftar Subfolder ({currentLevelFolders.length})</span>
            </h4>

            {currentLevelFolders.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 border border-slate-200/80 rounded-2xl text-xs text-slate-500">
                <Folder className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                <p>Belum ada subfolder di level ini. Klik <strong>"+ Buat Folder Baru"</strong> untuk mengelompokkan foto.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {currentLevelFolders.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    onOpen={(f) => setCurrentFolderId(f.id)}
                    onRename={(f) =>
                      setRenameModal({
                        isOpen: true,
                        title: 'Ubah Nama Folder',
                        initialName: f.name,
                        itemId: f.id,
                        type: 'folder',
                      })
                    }
                    onDelete={handleDeleteFolder}
                    onDropPhoto={(photoId, targetId) => handleMovePhotos(targetId, [photoId])}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Photos Inside Current Folder Level */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-blue-500" />
                <span>
                  Foto di {currentFolderObj ? `Folder "${currentFolderObj.name}"` : 'Direktori Utama'} (
                  {currentLevelPhotos.length})
                </span>
              </h4>

              {currentLevelPhotos.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleSelectAllCurrentPhotos(currentLevelPhotos)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  {currentLevelPhotos.every((p) => selectedPhotoIds.includes(p.driveFileId))
                    ? 'Batalkan Pilih Semua'
                    : 'Pilih Semua di Folder Ini'}
                </button>
              )}
            </div>

            {currentLevelPhotos.length === 0 ? (
              <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl text-xs text-slate-500">
                <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                <p>Tidak ada foto langsung di dalam folder ini.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 items-start">
                {currentLevelPhotos.map((photo) => {
                  const isSelected = selectedPhotoIds.includes(photo.driveFileId);

                  return (
                    <div
                      key={photo.driveFileId}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', photo.driveFileId);
                        e.dataTransfer.setData('photoId', photo.driveFileId);
                      }}
                      className={`bg-white border rounded-2xl overflow-hidden shadow-sm group hover:shadow-md transition-all flex flex-col justify-between ${
                        isSelected ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md' : 'border-slate-200'
                      }`}
                    >
                      {/* Image container (9:16 Portrait) */}
                      <div
                        onClick={() => setPreviewPhoto(photo)}
                        className="relative w-full aspect-[9/16] bg-slate-950 overflow-hidden flex items-center justify-center cursor-pointer rounded-t-2xl shrink-0"
                        style={{ aspectRatio: '9 / 16', width: '100%' }}
                      >
                        <img
                          src={photo.thumbnailUrl || photo.webViewLink}
                          alt=""
                          aria-hidden="true"
                          className="absolute inset-0 w-full h-full object-cover opacity-25 filter blur-lg scale-110 pointer-events-none"
                        />
                        <img
                          src={photo.thumbnailUrl || photo.webViewLink}
                          alt={photo.name}
                          loading="lazy"
                          className="relative z-10 max-w-full max-h-full w-full h-full transition-transform duration-300 group-hover:scale-[1.02]"
                          style={{ objectFit: 'contain', objectPosition: 'center center' }}
                        />

                        {/* Select Checkbox */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelectPhoto(photo.driveFileId);
                          }}
                          className={`absolute top-2 left-2 z-20 p-1.5 rounded-lg shadow-sm transition-all ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-black/40 hover:bg-black/60 text-white/80 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Photo details */}
                      <div className="p-3 bg-white space-y-1.5">
                        <p className="text-xs font-semibold text-slate-800 truncate" title={photo.name}>
                          {photo.name}
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>{(photo.size / 1024 / 1024).toFixed(1)} MB</span>

                          {/* Menu */}
                          <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() =>
                                setActivePhotoMenuId(
                                  activePhotoMenuId === photo.driveFileId ? null : photo.driveFileId
                                )
                              }
                              className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {activePhotoMenuId === photo.driveFileId && (
                              <>
                                <div
                                  className="fixed inset-0 z-30"
                                  onClick={() => setActivePhotoMenuId(null)}
                                />
                                <div className="absolute right-0 bottom-full mb-1 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 py-1 text-xs">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActivePhotoMenuId(null);
                                      setRenameModal({
                                        isOpen: true,
                                        title: 'Ubah Nama File Foto',
                                        initialName: photo.name,
                                        itemId: photo.driveFileId,
                                        type: 'photo',
                                      });
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Ubah Nama File</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActivePhotoMenuId(null);
                                      setMoveCopyModal({
                                        isOpen: true,
                                        mode: 'move',
                                        targetPhotoIds: [photo.driveFileId],
                                        currentFolderId: photo.folderId || album.driveFolderId,
                                      });
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                  >
                                    <FolderTree className="w-3.5 h-3.5 text-blue-500" />
                                    <span>Pindahkan ke Folder</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActivePhotoMenuId(null);
                                      setMoveCopyModal({
                                        isOpen: true,
                                        mode: 'copy',
                                        targetPhotoIds: [photo.driveFileId],
                                        currentFolderId: photo.folderId || album.driveFolderId,
                                      });
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                  >
                                    <Copy className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>Salin ke Folder Lain</span>
                                  </button>

                                  {photo.folderId && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActivePhotoMenuId(null);
                                        handleMovePhotos(album.driveFolderId, [photo.driveFileId]);
                                      }}
                                      className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                    >
                                      <CornerDownRight className="w-3.5 h-3.5 text-indigo-500" />
                                      <span>Kembalikan ke Root</span>
                                    </button>
                                  )}

                                  <div className="my-1 border-t border-slate-100" />

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActivePhotoMenuId(null);
                                      handleDeletePhoto(photo);
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Hapus Foto</span>
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: PILIHAN & CATATAN PELANGGAN */}
      {/* ======================================================== */}
      {activeTab === 'selections' && (
        <div className="space-y-4">
          <div className="bg-rose-50 border border-rose-200 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider">
                Daftar Foto Favorit Pilihan Pelanggan
              </h4>
              <p className="text-xs text-rose-700 mt-0.5">
                Pelanggan telah memilih {clientSelection?.selectedPhotoIds.length || 0} foto dan memberikan catatan khusus.
              </p>
            </div>

            {selectedPhotosList.length > 0 && (
              <button
                onClick={() =>
                  downloadPhotosAsZip(
                    selectedPhotosList,
                    `${album.albumName.replace(/\s+/g, '_')}_Pilihan_${album.clientName.replace(/\s+/g, '_')}.zip`,
                    (pct, text) => setZipProgress({ active: true, percent: pct, text })
                  )
                }
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all shrink-0"
              >
                <Download className="w-4 h-4" />
                Download Foto Terpilih Saja (ZIP)
              </button>
            )}
          </div>

          {selectedPhotosList.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white border border-slate-200 rounded-3xl">
              <Heart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-800">Pelanggan Belum Memilih Foto</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Kirim tautan galeri kepada pelanggan agar mereka dapat menandai foto favorit dan menuliskan catatan cetak/retouch.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 items-start">
              {selectedPhotosList.map((photo) => {
                const note = clientSelection?.notes?.[photo.driveFileId];

                return (
                  <div
                    key={photo.driveFileId}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between"
                  >
                    <div
                      className="relative w-full aspect-[9/16] bg-slate-950 overflow-hidden flex items-center justify-center rounded-t-2xl shrink-0 cursor-pointer"
                      style={{ aspectRatio: '9 / 16', width: '100%' }}
                      onClick={() => setPreviewPhoto(photo)}
                    >
                      <img
                        src={photo.thumbnailUrl || photo.webViewLink}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 w-full h-full object-cover opacity-25 filter blur-lg scale-110 pointer-events-none"
                      />
                      <img
                        src={photo.thumbnailUrl || photo.webViewLink}
                        alt={photo.name}
                        className="relative z-10 max-w-full max-h-full w-full h-full"
                        style={{ objectFit: 'contain', objectPosition: 'center center' }}
                      />
                      <span className="absolute top-2 right-2 z-20 p-1.5 bg-rose-500 text-white rounded-full shadow-sm">
                        <Heart className="w-3.5 h-3.5 fill-current" />
                      </span>
                    </div>

                    <div className="p-3 space-y-2">
                      <p className="text-xs font-semibold text-slate-800 truncate">{photo.name}</p>

                      {note ? (
                        <div className="p-2 bg-amber-50 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 space-y-0.5">
                          <span className="font-bold flex items-center gap-1">
                            <FileText className="w-3 h-3 text-amber-600" /> Catatan Klien:
                          </span>
                          <p className="italic">"{note}"</p>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">Tanpa catatan tambahan</p>
                      )}

                      <button
                        onClick={() => downloadSinglePhoto(photo)}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-all"
                      >
                        <Download className="w-3.5 h-3.5" /> Unduh Foto Asli
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* FLOATING BULK ACTIONS BAR (When Photos are Selected) */}
      {/* ======================================================== */}
      {selectedPhotoIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-3 animate-fade-in max-w-2xl w-full mx-4">
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-bold font-mono">
              {selectedPhotoIds.length} foto terpilih
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700 hidden sm:block" />

          <div className="flex items-center gap-1.5 overflow-x-auto flex-1">
            <button
              type="button"
              onClick={() =>
                setMoveCopyModal({
                  isOpen: true,
                  mode: 'move',
                  targetPhotoIds: selectedPhotoIds,
                })
              }
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shrink-0"
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Pindahkan</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setMoveCopyModal({
                  isOpen: true,
                  mode: 'copy',
                  targetPhotoIds: selectedPhotoIds,
                })
              }
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shrink-0"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Salin</span>
            </button>

            <button
              type="button"
              onClick={() => handleMovePhotos(album.driveFolderId, selectedPhotoIds)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all shrink-0"
              title="Pindahkan foto kembali ke folder utama album"
            >
              <CornerDownRight className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Ke Root</span>
            </button>

            <button
              type="button"
              onClick={handleBulkDeletePhotos}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition-all shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSelectedPhotoIds([])}
            className="p-1 text-slate-400 hover:text-white shrink-0 ml-auto"
            title="Batalkan Pilihan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODALS */}
      {/* ======================================================== */}

      {/* 1. Create Folder Modal */}
      <CreateFolderModal
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        onSubmit={handleCreateFolder}
        parentFolderName={currentFolderObj?.name}
      />

      {/* 2. Rename Item Modal (Folder or Photo) */}
      <RenameItemModal
        isOpen={renameModal.isOpen}
        onClose={() => setRenameModal((prev) => ({ ...prev, isOpen: false }))}
        title={renameModal.title}
        initialName={renameModal.initialName}
        onSubmit={handleRenameSubmit}
      />

      {/* 3. Move or Copy Modal */}
      <MoveCopyModal
        isOpen={moveCopyModal.isOpen}
        onClose={() => setMoveCopyModal((prev) => ({ ...prev, isOpen: false }))}
        mode={moveCopyModal.mode}
        itemsCount={moveCopyModal.targetPhotoIds.length}
        folders={folders}
        rootFolderId={album.driveFolderId}
        rootFolderName={album.albumName}
        currentFolderId={moveCopyModal.currentFolderId}
        onSubmit={async (targetId) => {
          if (moveCopyModal.mode === 'move') {
            await handleMovePhotos(targetId, moveCopyModal.targetPhotoIds);
          } else {
            await handleCopyPhotos(targetId, moveCopyModal.targetPhotoIds);
          }
        }}
      />

      {/* 4. Upload Photos Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title={`Unggah Foto — ${
          uploadTargetFolderId !== album.driveFolderId && currentFolderObj
            ? `${album.albumName} / ${currentFolderObj.name}`
            : album.albumName
        }`}
        subtitle="Simpan foto asli berkualitas tinggi ke folder Google Drive pelanggan"
        maxWidth="2xl"
      >
        <PhotoUploader
          accessToken={accessToken}
          driveFolderId={uploadTargetFolderId || album.driveFolderId}
          onPhotosUploaded={handlePhotosUploaded}
          onClose={() => setIsUploadModalOpen(false)}
        />
      </Modal>

      {/* 5. Fullscreen Lightbox Preview */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-between p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="w-full flex items-center justify-between text-white p-2">
            <span className="text-xs font-semibold truncate max-w-xs">{previewPhoto.name}</span>
            <button
              onClick={() => setPreviewPhoto(null)}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold"
            >
              Tutup (ESC)
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center p-2 max-w-5xl max-h-[80vh]">
            <img
              src={
                `https://lh3.googleusercontent.com/u/0/d/${previewPhoto.driveFileId}=w2400` ||
                previewPhoto.webViewLink
              }
              alt={previewPhoto.name}
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="p-3 flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadSinglePhoto(previewPhoto);
              }}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Unduh Foto Asli (
              {(previewPhoto.size / 1024 / 1024).toFixed(2)} MB)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
