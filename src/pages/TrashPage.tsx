import React from 'react';
import { Trash2, RotateCcw, AlertTriangle, FolderKanban, ShieldAlert } from 'lucide-react';
import { TrashItem } from '../types';

interface TrashPageProps {
  trashItems: TrashItem[];
  onRestore: (albumId: string) => Promise<void>;
  onDeletePermanent: (albumId: string) => Promise<void>;
  onClearTrash: () => Promise<void>;
  isProcessing?: boolean;
}

export const TrashPage: React.FC<TrashPageProps> = ({
  trashItems,
  onRestore,
  onDeletePermanent,
  onClearTrash,
  isProcessing,
}) => {
  const handleEmptyAll = () => {
    if (confirm('Kosongkan seluruh keranjang sampah? Tindakan ini tidak dapat dibatalkan.')) {
      onClearTrash();
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Keranjang Sampah Album</h2>
          <p className="text-xs text-slate-500">
            Album yang dihapus disimpan di sini sementara dan dapat dipulihkan kapan saja.
          </p>
        </div>

        {trashItems.length > 0 && (
          <button
            onClick={handleEmptyAll}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all self-start sm:self-auto"
          >
            <Trash2 className="w-4 h-4" />
            Kosongkan Keranjang Sampah
          </button>
        )}
      </div>

      {/* Info notice */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3 text-xs text-slate-600">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
        <p>
          Album di keranjang sampah tidak dapat dibuka oleh pelanggan melalui tautan publik. Memulihkan album akan mengaktifkan kembali tautan dan QR Code pelanggan secara instan.
        </p>
      </div>

      {/* Trash List */}
      {trashItems.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Trash2 className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">Keranjang Sampah Kosong</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Tidak ada album yang sedang berada di keranjang sampah.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm divide-y divide-slate-100 overflow-hidden">
          {trashItems.map((item) => (
            <div
              key={item.albumId}
              className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                  <FolderKanban className="w-5 h-5" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">{item.albumName}</h4>
                    <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {item.galleryId}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    👤 Pelanggan: {item.clientName} • 📸 {item.photoCount} Foto • Dihapus: {new Date(item.deletedAt).toLocaleDateString('id-ID')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  onClick={() => onRestore(item.albumId)}
                  disabled={isProcessing}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Pulihkan
                </button>

                <button
                  onClick={() => {
                    if (confirm(`Hapus permanen album "${item.albumName}"?`)) {
                      onDeletePermanent(item.albumId);
                    }
                  }}
                  disabled={isProcessing}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-xl text-xs font-semibold transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus Permanen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
