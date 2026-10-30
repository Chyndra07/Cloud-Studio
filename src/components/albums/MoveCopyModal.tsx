import React, { useState } from 'react';
import { Folder, FolderTree, ArrowRight, Copy, Check, CornerDownRight } from 'lucide-react';
import { AlbumFolder } from '../../types';
import { Modal } from '../common/Modal';

interface MoveCopyModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'move' | 'copy';
  itemsCount: number;
  folders: AlbumFolder[];
  rootFolderId: string;
  rootFolderName: string;
  currentFolderId?: string;
  onSubmit: (targetFolderId: string) => Promise<void>;
  isProcessing?: boolean;
}

export const MoveCopyModal: React.FC<MoveCopyModalProps> = ({
  isOpen,
  onClose,
  mode,
  itemsCount,
  folders,
  rootFolderId,
  rootFolderName,
  currentFolderId,
  onSubmit,
  isProcessing = false,
}) => {
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>(rootFolderId);
  const [error, setError] = useState<string | null>(null);

  const isMove = mode === 'move';

  const handleConfirm = async () => {
    if (selectedDestinationId === currentFolderId) {
      setError('Item sudah berada di folder ini.');
      return;
    }
    setError(null);
    try {
      await onSubmit(selectedDestinationId);
      onClose();
    } catch (err: any) {
      setError(err?.message || `Gagal ${isMove ? 'memindahkan' : 'menyalin'} item.`);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-xs ${
              isMove ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            {isMove ? <FolderTree className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isMove ? 'Pindahkan' : 'Salin'} {itemsCount} Foto ke Folder Tujuan
            </h3>
            <p className="text-xs text-slate-500">
              Pilih folder tujuan di dalam album Google Drive.
            </p>
          </div>
        </div>

        {/* Folder Destination Selector List */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Pilih Folder Tujuan:
          </label>

          <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 bg-slate-50/50 p-1">
            {/* 1. Root Album Option */}
            <div
              onClick={() => {
                setSelectedDestinationId(rootFolderId);
                setError(null);
              }}
              className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                selectedDestinationId === rootFolderId
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'hover:bg-white text-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Folder className={`w-5 h-5 ${selectedDestinationId === rootFolderId ? 'text-white' : 'text-blue-500'}`} />
                <div>
                  <p className="text-xs font-bold">{rootFolderName || 'Direktori Utama (Root Album)'}</p>
                  <p className={`text-[10px] ${selectedDestinationId === rootFolderId ? 'text-blue-100' : 'text-slate-400'}`}>
                    Folder Utama
                  </p>
                </div>
              </div>

              {selectedDestinationId === rootFolderId && (
                <Check className="w-4 h-4 text-white shrink-0" />
              )}
            </div>

            {/* 2. Subfolders */}
            {folders.map((f) => {
              const isSelected = selectedDestinationId === f.id;
              const isCurrent = currentFolderId === f.id;

              return (
                <div
                  key={f.id}
                  onClick={() => {
                    setSelectedDestinationId(f.id);
                    setError(null);
                  }}
                  className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isCurrent
                      ? 'bg-slate-100/80 text-slate-400 opacity-60'
                      : 'hover:bg-white text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 pl-3">
                    <CornerDownRight
                      className={`w-4 h-4 ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}
                    />
                    <Folder
                      className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-amber-500'}`}
                    />
                    <div>
                      <p className="text-xs font-bold">{f.name}</p>
                      <p
                        className={`text-[10px] ${
                          isSelected ? 'text-blue-100' : 'text-slate-400'
                        }`}
                      >
                        {f.path || f.name} • {f.photoCount || 0} foto
                        {isCurrent ? ' (Lokasi Saat Ini)' : ''}
                      </p>
                    </div>
                  </div>

                  {isSelected && <Check className="w-4 h-4 text-white shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-sm transition-all flex items-center gap-1.5 ${
              isMove ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isProcessing ? (
              <span>Memproses...</span>
            ) : (
              <>
                <span>{isMove ? 'Pindahkan Sekarang' : 'Salin Sekarang'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
