import React, { useState, useEffect } from 'react';
import { Edit3 } from 'lucide-react';
import { Modal } from '../common/Modal';

interface RenameItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  initialName: string;
  onSubmit: (newName: string) => Promise<void>;
  isProcessing?: boolean;
}

export const RenameItemModal: React.FC<RenameItemModalProps> = ({
  isOpen,
  onClose,
  title,
  initialName,
  onSubmit,
  isProcessing = false,
}) => {
  const [name, setName] = useState(initialName || '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialName || '');
      setError(null);
    }
  }, [isOpen, initialName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Nama tidak boleh kosong.');
      return;
    }
    if (cleanName === initialName.trim()) {
      onClose();
      return;
    }
    if (cleanName.includes('/') || cleanName.includes('\\')) {
      setError('Nama tidak boleh mengandung karakter / atau \\');
      return;
    }

    try {
      await onSubmit(cleanName);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Gagal mengubah nama di Google Drive.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-xs">
            <Edit3 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">Perubahan nama akan langsung diperbarui di Google Drive.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nama Baru
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
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
              disabled={isProcessing || !name.trim()}
              className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-xl shadow-sm transition-all"
            >
              {isProcessing ? 'Menyimpan...' : 'Simpan Nama'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
