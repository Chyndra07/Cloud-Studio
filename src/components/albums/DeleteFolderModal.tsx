import React, { useState } from 'react';
import { AlertTriangle, Folder, FolderSymlink, Trash2, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { AlbumFolder } from '../../types';

interface DeleteFolderModalProps {
  isOpen: boolean;
  folder: AlbumFolder | null;
  photoCount: number;
  onClose: () => void;
  onConfirm: (folder: AlbumFolder, movePhotosToRoot: boolean) => Promise<void>;
}

export const DeleteFolderModal: React.FC<DeleteFolderModalProps> = ({
  isOpen,
  folder,
  photoCount,
  onClose,
  onConfirm,
}) => {
  const [deleteMode, setDeleteMode] = useState<'move' | 'purge'>('move');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !folder) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const movePhotos = photoCount > 0 ? deleteMode === 'move' : false;
      await onConfirm(folder, movePhotos);
      onClose();
    } catch {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden transform transition-all">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${photoCount > 0 ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}>
              {photoCount > 0 ? <AlertTriangle className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Hapus Folder</h3>
              <p className="text-xs text-slate-500 font-medium truncate max-w-[240px]">
                "{folder.name}"
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {photoCount > 0 ? (
            <>
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 space-y-1">
                  <p className="font-bold">Folder ini berisi {photoCount} foto!</p>
                  <p className="text-amber-700 leading-relaxed">
                    Pilih bagaimana Anda ingin menangani foto-foto di dalam folder ini sebelum folder dihapus:
                  </p>
                </div>
              </div>

              {/* Selection Options */}
              <div className="space-y-2.5 pt-1">
                <label
                  onClick={() => setDeleteMode('move')}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    deleteMode === 'move'
                      ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="deleteMode"
                    value="move"
                    checked={deleteMode === 'move'}
                    onChange={() => setDeleteMode('move')}
                    className="mt-1 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <FolderSymlink className="w-4 h-4 text-blue-600" />
                      <span>Pindahkan Seluruh Foto ke Direktori Utama (Root)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      <strong>Rekomendasi Aman:</strong> Foto tidak akan hilang dari album pelanggan. Hanya foldernya saja yang dihapus di Google Drive.
                    </p>
                  </div>
                </label>

                <label
                  onClick={() => setDeleteMode('purge')}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    deleteMode === 'purge'
                      ? 'border-rose-500 bg-rose-50/60 ring-2 ring-rose-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="deleteMode"
                    value="purge"
                    checked={deleteMode === 'purge'}
                    onChange={() => setDeleteMode('purge')}
                    className="mt-1 text-rose-600 focus:ring-rose-500"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-rose-700">
                      <Trash2 className="w-4 h-4 text-rose-600" />
                      <span>Hapus Folder Beserta Seluruh Foto di Dalamnya</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      <strong>Tindakan Permanen:</strong> Seluruh {photoCount} foto di dalam folder ini akan dihapus dari Google Drive dan album.
                    </p>
                  </div>
                </label>
              </div>
            </>
          ) : (
            <div className="text-center py-4 space-y-2">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                <Folder className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-600">
                Folder <strong className="text-slate-900">"{folder.name}"</strong> saat ini kosong (0 foto).
              </p>
              <p className="text-xs text-slate-400">
                Apakah Anda yakin ingin menghapus folder ini dari Google Drive? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex items-center gap-2 px-5 py-2 text-xs font-bold text-white rounded-xl shadow-md transition-all ${
                photoCount > 0 && deleteMode === 'move'
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
              } disabled:opacity-50`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : photoCount > 0 ? (
                deleteMode === 'move' ? (
                  <>
                    <FolderSymlink className="w-3.5 h-3.5" />
                    <span>Pindahkan & Hapus Folder</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Folder & Foto</span>
                  </>
                )
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Folder</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
