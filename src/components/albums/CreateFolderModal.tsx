import React, { useState, useEffect } from 'react';
import { FolderPlus, X, Folder } from 'lucide-react';
import { Modal } from '../common/Modal';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (folderName: string) => Promise<void>;
  parentFolderName?: string;
  isProcessing?: boolean;
}

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  parentFolderName,
  isProcessing = false,
}) => {
  const [folderName, setFolderName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFolderName('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = folderName.trim();
    if (!cleanName) {
      setError('Nama folder tidak boleh kosong.');
      return;
    }
    if (cleanName.includes('/') || cleanName.includes('\\')) {
      setError('Nama folder tidak boleh mengandung garis miring (/ atau \\).');
      return;
    }

    try {
      await onSubmit(cleanName);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Gagal membuat folder di Google Drive.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
            <FolderPlus className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {parentFolderName ? `Buat Subfolder di "${parentFolderName}"` : 'Buat Folder Baru'}
            </h3>
            <p className="text-xs text-slate-500">
              Folder akan langsung disinkronkan ke direktori Google Drive album.
            </p>
          </div>
        </div>

        {parentFolderName && (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
            <Folder className="w-4 h-4 text-blue-500 shrink-0" />
            <span>Lokasi Induk: <strong>{parentFolderName}</strong></span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nama Folder
            </label>
            <input
              type="text"
              autoFocus
              value={folderName}
              onChange={(e) => {
                setFolderName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Contoh: Akad Nikah, Resepsi, Prewedding..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
              type="submit"
              disabled={isProcessing || !folderName.trim()}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-sm transition-all"
            >
              {isProcessing ? 'Membuat Folder...' : 'Buat Folder'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
