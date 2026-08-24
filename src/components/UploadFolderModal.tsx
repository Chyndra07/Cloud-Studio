import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  FolderUp,
  FolderOpen,
  HardDrive,
  Images,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Plus,
  ArrowRight,
  Sparkles,
  Lock,
  Layers,
  FileCheck,
  Ban,
  Calendar,
  User,
  ExternalLink,
  ChevronDown,
  Trash2,
  FolderCheck,
  FolderTree,
  FileText,
  Pencil,
  Check
} from 'lucide-react';
import { Album, Photo, StudioProfile, UserAccount } from '../types';
import {
  StagedFolder,
  StagedFile,
  MultiFolderUploadStats,
  scanMultipleFolders,
  scanDroppedEntries,
  formatBytes,
  executeMultiFolderUploadQueue,
} from '../services/folderUploadEngine';
import { createAlbumDriveFolder } from '../services/googleDrive';
import { getStoredUserToken } from '../services/googleAuth';

interface UploadFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserAccount | null;
  studioProfile: StudioProfile;
  albums: Album[];
  photos: Photo[];
  preselectedAlbumId?: string;
  initialFiles?: FileList | File[] | null;
  onConnectDrive: () => void;
  onCreateAlbum: (albumData: Partial<Album>) => Promise<Album>;
  onAddPhotosToAlbum: (albumId: string, photos: Photo[]) => void;
  onNavigateToAlbum: (album: Album) => void;
}

type ModalStep = 'staging' | 'uploading' | 'completed';

export const UploadFolderModal: React.FC<UploadFolderModalProps> = ({
  isOpen,
  onClose,
  user,
  studioProfile,
  albums,
  photos,
  preselectedAlbumId,
  initialFiles,
  onConnectDrive,
  onCreateAlbum,
  onAddPhotosToAlbum,
  onNavigateToAlbum,
}) => {
  const [step, setStep] = useState<ModalStep>('staging');
  const [stagedFolders, setStagedFolders] = useState<StagedFolder[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>(
    preselectedAlbumId || (albums.length > 0 ? albums[0].id : '')
  );

  // New Album Form if opened from outside an existing album
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().split('T')[0]);

  // Duplicate policy
  const [duplicatePolicy, setDuplicatePolicy] = useState<'skip' | 'allow'>('skip');

  // Upload state
  const [uploadStats, setUploadStats] = useState<MultiFolderUploadStats | null>(null);
  const [targetAlbum, setTargetAlbum] = useState<Album | null>(null);
  const [isProcessingAlbumCreation, setIsProcessingAlbumCreation] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Rename folder in staging state
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameWarning, setRenameWarning] = useState<string | null>(null);

  // Abort controller
  const abortControllerRef = useRef<AbortController | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const addMoreFolderInputRef = useRef<HTMLInputElement>(null);

  // Set initial preselected album if provided
  useEffect(() => {
    if (preselectedAlbumId) {
      setSelectedAlbumId(preselectedAlbumId);
      const found = albums.find((a) => a.id === preselectedAlbumId);
      if (found) {
        setTargetAlbum(found);
      }
    } else if (albums.length > 0 && !selectedAlbumId) {
      setSelectedAlbumId(albums[0].id);
      setTargetAlbum(albums[0]);
    }
  }, [preselectedAlbumId, albums]);

  // Process initial files if supplied
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      handleFilesAppended(Array.from(initialFiles));
    }
  }, [initialFiles]);

  if (!isOpen) return null;

  const currentPreselectedAlbum = preselectedAlbumId
    ? albums.find((a) => a.id === preselectedAlbumId) || null
    : null;

  const totalValidPhotos = stagedFolders.reduce((sum, f) => sum + f.validCount, 0);
  const totalSizeBytes = stagedFolders.reduce((sum, f) => sum + f.totalSizeBytes, 0);

  const handleFilesAppended = (files: File[]) => {
    setErrorMessage(null);
    setStagedFolders((prev) => {
      const updated = scanMultipleFolders(files, prev);
      if (updated.length > 0 && !newAlbumName) {
        setNewAlbumName(updated[0].name);
        setNewCustomerName(updated[0].name);
      }
      return updated;
    });
  };

  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesAppended(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleRemoveFolder = (folderId: string) => {
    setStagedFolders((prev) => prev.filter((f) => f.id !== folderId));
    if (editingFolderId === folderId) {
      setEditingFolderId(null);
      setEditingFolderName('');
      setRenameError(null);
    }
  };

  const handleClearAllFolders = () => {
    setStagedFolders([]);
    setEditingFolderId(null);
    setEditingFolderName('');
    setRenameError(null);
    setRenameWarning(null);
  };

  const handleStartRename = (folder: StagedFolder) => {
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
    setRenameError(null);
    setRenameWarning(null);
  };

  const handleCancelRename = () => {
    setEditingFolderId(null);
    setEditingFolderName('');
    setRenameError(null);
  };

  const handleSaveRename = (folderId: string) => {
    const trimmed = editingFolderName.trim();
    if (!trimmed) {
      setRenameError('Nama folder tidak boleh kosong.');
      return;
    }

    // Disallow illegal characters
    if (/[/\\:*?"<>|]/.test(trimmed)) {
      setRenameError('Nama folder tidak boleh mengandung karakter khusus seperti / \\ : * ? " < > |');
      return;
    }

    // Check duplicate in the staged batch
    const duplicate = stagedFolders.some(
      (f) => f.id !== folderId && f.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      setRenameError(`Nama folder "${trimmed}" sudah digunakan oleh folder lain dalam antrian.`);
      return;
    }

    // Check if name already exists in target destination album
    const targetAlbumToUse = currentPreselectedAlbum || albums.find((a) => a.id === selectedAlbumId);
    if (targetAlbumToUse) {
      const existsInAlbum = photos.some(
        (p) =>
          p.albumId === targetAlbumToUse.id &&
          !p.isDeleted &&
          p.folderName?.toLowerCase() === trimmed.toLowerCase()
      );
      if (existsInAlbum) {
        setRenameWarning(
          `Peringatan: Folder "${trimmed}" sudah ada di album tujuan. Foto akan ditambahkan ke folder tersebut di Google Drive.`
        );
      }
    }

    // Update the staged folder and the StagedFile paths & pathSegments inside it
    setStagedFolders((prev) =>
      prev.map((folder) => {
        if (folder.id !== folderId) return folder;

        const newRootName = trimmed;
        const updatedFiles: StagedFile[] = folder.files.map((fileItem) => {
          // Keep remaining subfolder segments intact
          const subSegments = fileItem.pathSegments.length > 1 ? fileItem.pathSegments.slice(1) : [];
          const updatedSegments = [newRootName, ...subSegments];
          const updatedFolderPath = updatedSegments.join('/');

          return {
            ...fileItem,
            folderName: newRootName,
            folderPath: updatedFolderPath,
            pathSegments: updatedSegments,
          };
        });

        return {
          ...folder,
          name: newRootName,
          files: updatedFiles,
        };
      })
    );

    setEditingFolderId(null);
    setEditingFolderName('');
    setRenameError(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    try {
      const files = await scanDroppedEntries(e.dataTransfer);
      if (files.length > 0) {
        handleFilesAppended(files);
      } else {
        setErrorMessage('Tidak ditemukan file foto dalam folder yang ditarik.');
      }
    } catch (err: any) {
      console.error('Error reading dropped folder:', err);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFilesAppended(Array.from(e.dataTransfer.files));
      }
    }
  };

  // Start the upload execution
  const handleStartUpload = async (stagedOverride?: StagedFolder[]) => {
    if (!user) {
      setErrorMessage('Sesi pengguna tidak valid. Silakan login kembali.');
      return;
    }

    if (!user.isConnectedToDrive) {
      setErrorMessage('Google Drive belum terhubung.');
      return;
    }

    const foldersToUpload = stagedOverride || stagedFolders;
    if (foldersToUpload.length === 0 || totalValidPhotos === 0) {
      setErrorMessage('Pilih setidaknya 1 folder foto untuk diunggah.');
      return;
    }

    setIsProcessingAlbumCreation(true);
    setErrorMessage(null);

    const token = getStoredUserToken(user.id) || user.accessToken || null;
    let destinationAlbum: Album | null = null;

    try {
      if (currentPreselectedAlbum) {
        // Direct target from AlbumDetail
        destinationAlbum = currentPreselectedAlbum;
      } else if (selectedAlbumId) {
        destinationAlbum = albums.find((a) => a.id === selectedAlbumId) || null;
      }

      // If no album exists yet, create one
      if (!destinationAlbum) {
        const albumTitle = newAlbumName.trim() || foldersToUpload[0]?.name || 'Album Foto Baru';
        const customer = newCustomerName.trim() || albumTitle;

        let driveFolderId: string | undefined = undefined;
        let driveFolderUrl: string | undefined = undefined;

        if (token && user.driveAlbumFolderId) {
          try {
            const driveFolder = await createAlbumDriveFolder(
              token,
              `${albumTitle} - ${customer}`,
              user.driveAlbumFolderId
            );
            driveFolderId = driveFolder.id;
            driveFolderUrl = driveFolder.webViewLink;
          } catch (driveErr: any) {
            console.warn('Drive folder creation notice:', driveErr.message);
            driveFolderId = `drive_folder_${Date.now()}`;
          }
        } else {
          driveFolderId = `drive_folder_${Date.now()}`;
        }

        destinationAlbum = await onCreateAlbum({
          eventName: albumTitle,
          customerName: customer,
          eventDate: newEventDate,
          displayQuality: 'hd',
          driveFolderId,
          driveFolderUrl,
        });
      }

      setTargetAlbum(destinationAlbum);
      setStep('uploading');
      setIsProcessingAlbumCreation(false);

      // Create new abort controller
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Existing photo filenames for duplicate detection
      const existingPhotosForAlbum = photos
        .filter((p) => p.albumId === destinationAlbum!.id && !p.isDeleted)
        .map((p) => p.filename);

      const result = await executeMultiFolderUploadQueue({
        stagedFolders: foldersToUpload,
        album: destinationAlbum,
        user,
        token,
        duplicatePolicy,
        existingPhotoFilenames: existingPhotosForAlbum,
        concurrency: 3,
        maxRetries: 2,
        onProgress: (stats) => {
          setUploadStats(stats);
        },
        signal: abortController.signal,
      });

      // Commit uploaded photos to persistent storage & server
      if (result.uploadedPhotos.length > 0) {
        onAddPhotosToAlbum(destinationAlbum.id, result.uploadedPhotos);
      }

      setUploadStats(result.stats);
      setStep('completed');
    } catch (err: any) {
      setIsProcessingAlbumCreation(false);
      setErrorMessage(err.message || 'Terjadi kesalahan saat memulai upload folder.');
    }
  };

  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      if (confirm('Batalkan sisa antrian upload? Foto yang sudah berhasil diunggah akan tetap tersimpan di Google Drive dan album.')) {
        abortControllerRef.current.abort();
      }
    }
  };

  const handleRetryFailed = () => {
    if (!uploadStats || uploadStats.failedItems.length === 0) return;
    const failedFiles = uploadStats.failedItems.map((item) => item.file);
    const rescanned = scanMultipleFolders(failedFiles, []);
    handleStartUpload(rescanned);
  };

  const handleFinishAndOpenAlbum = () => {
    if (targetAlbum) {
      onNavigateToAlbum(targetAlbum);
      onClose();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      {/* Hidden Folder Pickers */}
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFolderInputChange}
        // @ts-ignore
        webkitdirectory=""
        // @ts-ignore
        directory=""
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={addMoreFolderInputRef}
        onChange={handleFolderInputChange}
        // @ts-ignore
        webkitdirectory=""
        // @ts-ignore
        directory=""
        multiple
        className="hidden"
      />

      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Top Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-xs text-white font-bold bg-blue-600">
              <FolderUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">
                  Upload Folder Foto
                </h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <FolderCheck className="w-3 h-3 text-emerald-600" />
                  Mode: Pertahankan Folder
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Struktur folder, subfolder, dan nama folder akan dipertahankan utuh ke Google Drive
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={step === 'uploading' && !uploadStats?.isComplete}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* ========================================================================= */}
          {/* 1. GOOGLE DRIVE NOT CONNECTED WARNING                                     */}
          {/* ========================================================================= */}
          {!user?.isConnectedToDrive ? (
            <div className="text-center py-10 space-y-4 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
                <HardDrive className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-900">Google Drive Belum Terhubung</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Hubungkan akun Google Drive studio Anda terlebih dahulu untuk mengunggah folder foto dan membuat struktur folder otomatis.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={onConnectDrive}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <HardDrive className="w-4 h-4" />
                  <span>Hubungkan Google Drive</span>
                </button>
                <button
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          ) : step === 'staging' ? (
            /* ========================================================================= */
            /* 2. MULTI-FOLDER SELECTION & STAGING VIEW                                  */
            /* ========================================================================= */
            <div className="space-y-5">
              
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Target Album Info Card */}
              {currentPreselectedAlbum ? (
                <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
                      <FolderTree className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wide block">
                        Album Tujuan
                      </span>
                      <p className="text-xs font-extrabold text-slate-900 truncate">
                        {currentPreselectedAlbum.eventName} ({currentPreselectedAlbum.customerName})
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-blue-800 bg-white px-2.5 py-1 rounded-lg border border-blue-200 shrink-0">
                    ID: {currentPreselectedAlbum.galleryId}
                  </span>
                </div>
              ) : (
                /* Select or create album if opened globally */
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Pilih Album Tujuan
                  </label>
                  {albums.length > 0 ? (
                    <select
                      value={selectedAlbumId}
                      onChange={(e) => setSelectedAlbumId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                    >
                      {albums
                        .filter((a) => !a.isDeleted)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.eventName} ({a.customerName}) — {a.photosCount} foto
                          </option>
                        ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={newAlbumName}
                      onChange={(e) => setNewAlbumName(e.target.value)}
                      placeholder="Nama Album Baru (cth: Pernikahan Andi & Sinta)"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-semibold"
                    />
                  )}
                </div>
              )}

              {/* Informative Rule Badge */}
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>✓ Nama & Struktur Folder Dipertahankan:</strong> Setiap folder yang Anda pilih akan tetap terpisah menjadi folder tersendiri di dalam album dan Google Drive.
                </span>
              </div>

              {/* STAGED FOLDERS LIST */}
              {stagedFolders.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <span>Folder Terpilih — {stagedFolders.length} Folder</span>
                      <span className="text-[11px] font-normal text-slate-500 lowercase">
                        ({totalValidPhotos} foto • {formatBytes(totalSizeBytes)})
                      </span>
                    </h4>

                    <button
                      type="button"
                      onClick={handleClearAllFolders}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer hover:underline"
                    >
                      Hapus Semua
                    </button>
                  </div>

                  {renameWarning && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>{renameWarning}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRenameWarning(null)}
                        className="text-amber-600 hover:text-amber-900 font-bold text-xs p-1"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* List of Staged Folder Cards */}
                  <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                    {stagedFolders.map((folder) => {
                      const isEditingThisFolder = editingFolderId === folder.id;

                      return (
                        <div
                          key={folder.id}
                          className={`p-3.5 rounded-xl border transition shadow-2xs ${
                            isEditingThisFolder
                              ? 'bg-blue-50/40 border-blue-400 ring-2 ring-blue-500/10'
                              : 'bg-white border-slate-200 hover:border-blue-300'
                          }`}
                        >
                          {isEditingThisFolder ? (
                            /* INLINE EDIT MODE */
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
                                  <Pencil className="w-4 h-4" />
                                </div>
                                <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                  <input
                                    type="text"
                                    value={editingFolderName}
                                    onChange={(e) => {
                                      setEditingFolderName(e.target.value);
                                      setRenameError(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSaveRename(folder.id);
                                      } else if (e.key === 'Escape') {
                                        e.preventDefault();
                                        handleCancelRename();
                                      }
                                    }}
                                    autoFocus
                                    placeholder="Nama folder baru"
                                    className="flex-1 px-3 py-1.5 bg-white border border-blue-500 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                  />
                                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                    <button
                                      type="button"
                                      onClick={() => handleSaveRename(folder.id)}
                                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                      title="Simpan nama folder baru"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Simpan</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleCancelRename}
                                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                                      title="Batal ubah nama"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                      <span>Batal</span>
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {renameError && (
                                <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1.5 pl-10">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span>{renameError}</span>
                                </p>
                              )}
                            </div>
                          ) : (
                            /* NORMAL STAGED FOLDER CARD */
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0 border border-blue-100">
                                  <FolderOpen className="w-5 h-5" />
                                </div>

                                <div className="min-w-0 space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-900 truncate">
                                      📁 {folder.name}
                                    </span>
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                                      {folder.validCount} Foto
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                    <span>Total {formatBytes(folder.totalSizeBytes)}</span>
                                    {folder.subfolders.length > 0 && (
                                      <>
                                        <span>•</span>
                                        <span className="text-blue-600 font-medium">
                                          Subfolder: {folder.subfolders.join(', ')}
                                        </span>
                                      </>
                                    )}
                                    {folder.skippedFiles.length > 0 && (
                                      <>
                                        <span>•</span>
                                        <span className="text-amber-600">
                                          ({folder.skippedFiles.length} file non-foto dilewati)
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleStartRename(folder)}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-semibold transition flex items-center gap-1.5 border border-slate-200 hover:border-blue-200 cursor-pointer shadow-2xs"
                                  title={`Ubah nama folder ${folder.name}`}
                                >
                                  <Pencil className="w-3.5 h-3.5 text-slate-500 hover:text-blue-600" />
                                  <span>Rename</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveFolder(folder.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title={`Hapus folder ${folder.name} dari daftar`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add More Folder Drop / Click Button */}
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => addMoreFolderInputRef.current?.click()}
                      className="flex-1 py-2.5 px-4 rounded-xl border border-dashed border-blue-400 bg-blue-50/40 hover:bg-blue-50 text-blue-700 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Tambah Folder Berikutnya</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* EMPTY STATE: DRAG & DROP FOLDERS OR PICK */
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => folderInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition cursor-pointer relative overflow-hidden bg-slate-50/50 hover:bg-blue-50/30 ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50/60 scale-[1.01]'
                      : 'border-slate-200 hover:border-blue-400'
                  }`}
                >
                  <div className="max-w-md mx-auto space-y-3 pointer-events-none">
                    <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center bg-blue-50 text-blue-600 shadow-2xs">
                      <FolderOpen className="w-7 h-7" />
                    </div>

                    <div>
                      <h4 className="text-base font-bold text-slate-900">
                        Pilih Satu atau Beberapa Folder Foto
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Tarik dan letakkan folder di sini, atau klik untuk memilih folder dari komputer
                      </p>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-xs"
                      >
                        Pilih Folder Sekarang
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400">
                      Mendukung multi-folder (contoh: 01. Akad, 02. Resepsi, 03. Keluarga, 04. Tamu)
                    </p>
                  </div>
                </div>
              )}

              {/* Duplicate Handling Policy */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-800 block">Kebijakan Duplikat File</span>
                  <span className="text-slate-500 text-[11px] block">
                    Jika ditemukan file foto dengan nama yang sama di folder tujuan
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="dupPolicy"
                      value="skip"
                      checked={duplicatePolicy === 'skip'}
                      onChange={() => setDuplicatePolicy('skip')}
                      className="text-blue-600"
                    />
                    <span className="font-semibold text-slate-700">Lewati Duplikat</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="dupPolicy"
                      value="allow"
                      checked={duplicatePolicy === 'allow'}
                      onChange={() => setDuplicatePolicy('allow')}
                      className="text-blue-600"
                    />
                    <span className="font-medium text-slate-600">Upload Ulang</span>
                  </label>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="button"
                  disabled={isProcessingAlbumCreation || stagedFolders.length === 0 || totalValidPhotos === 0}
                  onClick={() => handleStartUpload()}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FolderUp className="w-4 h-4" />
                  <span>
                    {isProcessingAlbumCreation
                      ? 'Menyiapkan Folder...'
                      : stagedFolders.length > 1
                      ? `Upload ${stagedFolders.length} Folder (${totalValidPhotos} Foto)`
                      : stagedFolders.length === 1
                      ? `Upload 1 Folder (${totalValidPhotos} Foto)`
                      : 'Pilih Folder Terlebih Dahulu'}
                  </span>
                </button>
              </div>

            </div>
          ) : step === 'uploading' && uploadStats ? (
            /* ========================================================================= */
            /* 3. REALTIME MULTI-FOLDER PROGRESS VIEW                                    */
            /* ========================================================================= */
            <div className="py-6 space-y-6 max-w-lg mx-auto">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-2xs animate-pulse">
                  <FolderUp className="w-6 h-6 animate-bounce" />
                </div>
                <h4 className="text-base font-bold text-slate-900">
                  Mengunggah Folder ke Google Drive...
                </h4>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-blue-700 truncate max-w-sm mx-auto">
                    {uploadStats.currentFolderName ? `📁 Folder Aktif: ${uploadStats.currentFolderName}` : 'Memproses folder...'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono truncate max-w-sm mx-auto">
                    {uploadStats.currentFileName ? `File: ${uploadStats.currentFileName}` : 'Memproses antrian...'}
                  </p>
                </div>
              </div>

              {/* Progress Bar & Percentage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>
                    {uploadStats.processedFiles} dari {uploadStats.totalFiles} foto ({uploadStats.totalFolders} folder)
                  </span>
                  <span className="text-blue-600 text-sm font-extrabold">{uploadStats.percent}%</span>
                </div>

                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200 p-0.5">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-300 shadow-xs"
                    style={{ width: `${uploadStats.percent}%` }}
                  />
                </div>
              </div>

              {/* Stat Counters */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-lg font-bold text-emerald-700 block">{uploadStats.successfulFiles}</span>
                  <span className="text-[10px] font-semibold text-emerald-600 uppercase">Berhasil</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-lg font-bold text-slate-700 block">{uploadStats.skippedFiles}</span>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">Dilewati</span>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                  <span className="text-lg font-bold text-rose-700 block">{uploadStats.failedFiles}</span>
                  <span className="text-[10px] font-semibold text-rose-600 uppercase">Gagal</span>
                </div>
              </div>

              {/* Cancel Button */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={handleCancelUpload}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 transition cursor-pointer"
                >
                  Batalkan Sisa Antrian
                </button>
              </div>
            </div>
          ) : step === 'completed' && uploadStats ? (
            /* ========================================================================= */
            /* 4. MULTI-FOLDER COMPLETED SUMMARY VIEW                                    */
            /* ========================================================================= */
            <div className="py-6 space-y-6 text-center max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h4 className="text-lg font-bold text-slate-900">Upload Folder Selesai</h4>
                <p className="text-xs text-slate-500">
                  Semua folder dan foto berhasil diunggah dengan struktur folder utuh ke Google Drive & galeri studio.
                </p>
              </div>

              {/* Results Breakdown */}
              <div className="grid grid-cols-4 gap-2 text-center p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="p-2">
                  <span className="text-base font-extrabold text-slate-900 block">{uploadStats.totalFiles}</span>
                  <span className="text-[10px] text-slate-500">Total Foto</span>
                </div>
                <div className="p-2">
                  <span className="text-base font-extrabold text-emerald-600 block">{uploadStats.successfulFiles}</span>
                  <span className="text-[10px] text-emerald-700 font-semibold">Berhasil</span>
                </div>
                <div className="p-2">
                  <span className="text-base font-extrabold text-slate-600 block">{uploadStats.skippedFiles}</span>
                  <span className="text-[10px] text-slate-500">Dilewati</span>
                </div>
                <div className="p-2">
                  <span className="text-base font-extrabold text-rose-600 block">{uploadStats.failedFiles}</span>
                  <span className="text-[10px] text-rose-700 font-semibold">Gagal</span>
                </div>
              </div>

              {/* Retry on fail */}
              {uploadStats.failedFiles > 0 && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
                  <span>{uploadStats.failedFiles} foto gagal karena kendala koneksi.</span>
                  <button
                    type="button"
                    onClick={handleRetryFailed}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition cursor-pointer"
                  >
                    Coba Lagi File Gagal
                  </button>
                </div>
              )}

              {/* Navigation buttons */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleFinishAndOpenAlbum}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Lihat Album Sekarang</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          ) : null}

        </div>
      </div>
    </div>
  );
};
