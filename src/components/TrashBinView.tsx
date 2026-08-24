import React, { useState } from 'react';
import { 
  Trash2, 
  RotateCcw, 
  AlertTriangle, 
  Images, 
  Camera, 
  Loader2,
  CheckCircle2,
  X,
  XCircle,
  FolderOpen
} from 'lucide-react';
import { Album, Photo, StudioProfile } from '../types';

interface TrashBinViewProps {
  trashAlbums: Album[];
  trashPhotos: Photo[];
  studioProfile: StudioProfile;
  onRestoreAlbum: (albumId: string) => Promise<void> | void;
  onPermanentlyDeleteAlbum: (albumId: string) => Promise<void> | void;
  onRestorePhoto: (photoId: string) => Promise<void> | void;
  onPermanentlyDeletePhoto: (photoId: string) => Promise<void> | void;
  onEmptyTrash: () => Promise<void> | void;
}

interface ConfirmModalState {
  type: 'empty-all' | 'single-album' | 'single-photo' | null;
  targetId?: string;
  targetName?: string;
}

export const TrashBinView: React.FC<TrashBinViewProps> = ({
  trashAlbums,
  trashPhotos,
  studioProfile,
  onRestoreAlbum,
  onPermanentlyDeleteAlbum,
  onRestorePhoto,
  onPermanentlyDeletePhoto,
  onEmptyTrash,
}) => {
  const [activeTab, setActiveTab] = useState<'albums' | 'photos'>('albums');
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({ type: null });
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  
  // Toast notifications state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const totalTrashCount = trashAlbums.length + trashPhotos.length;

  // Handler to execute empty all trash
  const handleExecuteEmptyTrash = async () => {
    try {
      setIsProcessing(true);
      await onEmptyTrash();
      setConfirmModal({ type: null });
      showToast('Keranjang Sampah berhasil dikosongkan.', 'success');
    } catch (err: any) {
      console.error('[TrashBinView] Gagal mengosongkan keranjang sampah:', err);
      showToast('Beberapa item gagal dihapus. Silakan coba kembali.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler for single album permanent delete
  const handleExecuteDeleteAlbum = async (albumId: string) => {
    try {
      setIsProcessing(true);
      setActionLoadingId(`del_alb_${albumId}`);
      await onPermanentlyDeleteAlbum(albumId);
      setConfirmModal({ type: null });
      showToast('Album berhasil dihapus secara permanen.', 'success');
    } catch (err: any) {
      console.error('[TrashBinView] Gagal menghapus album permanen:', err);
      showToast('Gagal menghapus album secara permanen.', 'error');
    } finally {
      setIsProcessing(false);
      setActionLoadingId(null);
    }
  };

  // Handler for single photo permanent delete
  const handleExecuteDeletePhoto = async (photoId: string) => {
    try {
      setIsProcessing(true);
      setActionLoadingId(`del_photo_${photoId}`);
      await onPermanentlyDeletePhoto(photoId);
      setConfirmModal({ type: null });
      showToast('Foto berhasil dihapus secara permanen.', 'success');
    } catch (err: any) {
      console.error('[TrashBinView] Gagal menghapus foto permanen:', err);
      showToast('Gagal menghapus foto secara permanen.', 'error');
    } finally {
      setIsProcessing(false);
      setActionLoadingId(null);
    }
  };

  // Handler for restoring album
  const handleRestoreAlbum = async (albumId: string) => {
    if (isProcessing) return;
    try {
      setActionLoadingId(`res_alb_${albumId}`);
      await onRestoreAlbum(albumId);
      showToast('Album berhasil dipulihkan ke Album Pelanggan.', 'success');
    } catch (err: any) {
      console.error('[TrashBinView] Gagal memulihkan album:', err);
      showToast('Gagal memulihkan album.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handler for restoring photo
  const handleRestorePhoto = async (photoId: string) => {
    if (isProcessing) return;
    try {
      setActionLoadingId(`res_photo_${photoId}`);
      await onRestorePhoto(photoId);
      showToast('Foto berhasil dipulihkan.', 'success');
    } catch (err: any) {
      console.error('[TrashBinView] Gagal memulihkan foto:', err);
      showToast('Gagal memulihkan foto.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-200 relative pb-12">
      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-200">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${
              toast.type === 'success'
                ? 'bg-slate-900 text-white border-slate-800'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-slate-400 hover:text-white p-1 rounded transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Keranjang Sampah
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Item yang dihapus dapat dipulihkan kapan saja atau dibersihkan secara permanen.
          </p>
        </div>

        {totalTrashCount > 0 && (
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => setConfirmModal({ type: 'empty-all' })}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold hover:bg-rose-100 transition cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span className="whitespace-nowrap shrink-0">Kosongkan Keranjang Sampah</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('albums')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'albums'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Images className="w-4 h-4" />
          <span className="whitespace-nowrap shrink-0">Album Dihapus ({trashAlbums.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('photos')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'photos'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span className="whitespace-nowrap shrink-0">Foto Satuan Dihapus ({trashPhotos.length})</span>
        </button>
      </div>

      {/* Content: Album Tab */}
      {activeTab === 'albums' && (
        <div className="space-y-3">
          {trashAlbums.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-2 shadow-2xs">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Keranjang Sampah Kosong</h3>
              <p className="text-xs text-slate-500">Tidak ada album atau foto yang berada di Keranjang Sampah.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {trashAlbums.map((album) => {
                const isRestoring = actionLoadingId === `res_alb_${album.id}`;
                const isDeleting = actionLoadingId === `del_alb_${album.id}`;

                return (
                  <div
                    key={album.id}
                    className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs transition hover:border-slate-300"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
                        {album.coverPhotoUrl ? (
                          <img
                            src={album.coverPhotoUrl}
                            alt=""
                            className="w-full h-full object-cover grayscale opacity-70"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Images className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-700 text-sm line-through">
                          {album.eventName}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Klien: {album.customerName} • {album.photosCount} Foto • ID: {album.galleryId}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        disabled={isProcessing || isRestoring || isDeleting}
                        onClick={() => handleRestoreAlbum(album.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold hover:bg-blue-100 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isRestoring ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        <span className="whitespace-nowrap shrink-0">Pulihkan</span>
                      </button>

                      <button
                        type="button"
                        disabled={isProcessing || isRestoring || isDeleting}
                        onClick={() =>
                          setConfirmModal({
                            type: 'single-album',
                            targetId: album.id,
                            targetName: album.eventName,
                          })
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold hover:bg-rose-100 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span className="whitespace-nowrap shrink-0">Hapus Permanen</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Content: Photos Tab */}
      {activeTab === 'photos' && (
        <div className="space-y-3">
          {trashPhotos.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-2 shadow-2xs">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <Camera className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Keranjang Foto Kosong</h3>
              <p className="text-xs text-slate-500">Tidak ada foto satuan yang berada di Keranjang Sampah.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {trashPhotos.map((photo) => {
                const isRestoring = actionLoadingId === `res_photo_${photo.id}`;
                const isDeleting = actionLoadingId === `del_photo_${photo.id}`;

                return (
                  <div
                    key={photo.id}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden p-2 space-y-2 shadow-2xs transition hover:border-slate-300"
                  >
                    <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden relative">
                      <img
                        src={photo.thumbnailUrl}
                        alt={photo.filename}
                        className="w-full h-full object-cover grayscale opacity-70"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    <p className="text-[10px] text-slate-500 font-mono truncate text-center">
                      {photo.filename}
                    </p>

                    <div className="flex items-center justify-between gap-1">
                      <button
                        type="button"
                        disabled={isProcessing || isRestoring || isDeleting}
                        onClick={() => handleRestorePhoto(photo.id)}
                        className="flex-1 py-1 px-1.5 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-bold hover:bg-blue-100 transition cursor-pointer text-center flex items-center justify-center gap-1 disabled:opacity-50"
                        title="Pulihkan Foto"
                      >
                        {isRestoring ? (
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        ) : null}
                        <span>Pulihkan</span>
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing || isRestoring || isDeleting}
                        onClick={() =>
                          setConfirmModal({
                            type: 'single-photo',
                            targetId: photo.id,
                            targetName: photo.filename,
                          })
                        }
                        className="p-1.5 bg-rose-50 text-rose-700 rounded-lg hover:bg-rose-100 transition cursor-pointer disabled:opacity-50"
                        title="Hapus Permanen"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-3 h-3 animate-spin text-rose-600" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.type !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900">
                  {confirmModal.type === 'empty-all'
                    ? 'Kosongkan Keranjang Sampah?'
                    : confirmModal.type === 'single-album'
                    ? 'Hapus Album Permanen?'
                    : 'Hapus Foto Permanen?'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {confirmModal.type === 'empty-all'
                    ? 'Semua album dan foto yang berada di Keranjang Sampah akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.'
                    : confirmModal.type === 'single-album'
                    ? `Album "${confirmModal.targetName}" beserta seluruh file fotonya akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.`
                    : `Foto "${confirmModal.targetName}" akan dihapus secara permanen dari server dan Google Drive. Tindakan ini tidak dapat dibatalkan.`}
                </p>
              </div>
            </div>

            {/* Item Count Info for Empty All */}
            {confirmModal.type === 'empty-all' && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 font-medium flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-slate-500 shrink-0" />
                <span>
                  <strong>{trashAlbums.length} album</strong> dan <strong>{trashPhotos.length} foto</strong> akan dihapus permanen.
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setConfirmModal({ type: null })}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => {
                  if (confirmModal.type === 'empty-all') {
                    handleExecuteEmptyTrash();
                  } else if (confirmModal.type === 'single-album' && confirmModal.targetId) {
                    handleExecuteDeleteAlbum(confirmModal.targetId);
                  } else if (confirmModal.type === 'single-photo' && confirmModal.targetId) {
                    handleExecuteDeletePhoto(confirmModal.targetId);
                  }
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>
                      {confirmModal.type === 'empty-all'
                        ? 'Mengosongkan Keranjang Sampah...'
                        : 'Menghapus Permanen...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 text-white" />
                    <span>
                      {confirmModal.type === 'empty-all'
                        ? 'Hapus Semua Permanen'
                        : 'Hapus Permanen'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
