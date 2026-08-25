import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Shield, Calendar, RefreshCw, Clock, AlertCircle, FolderPlus } from 'lucide-react';
import { ExpirationAction } from '../../types';
import { generateDefaultPin } from '../../config/appConfig';
import { CreateAlbumParams } from '../../hooks/useStudioData';

interface CreateAlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: CreateAlbumParams) => Promise<any>;
  isProcessing: boolean;
}

export const CreateAlbumModal: React.FC<CreateAlbumModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isProcessing,
}) => {
  const [albumName, setAlbumName] = useState('');
  const [clientName, setClientName] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [pin, setPin] = useState(generateDefaultPin());
  const [isPinEnabled, setIsPinEnabled] = useState(true);
  const [expirationDays, setExpirationDays] = useState(30);
  const [expirationAction, setExpirationAction] = useState<ExpirationAction>('disable');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBusy = isProcessing || isSubmitting;

  const handleRegeneratePin = () => {
    setPin(generateDefaultPin());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy) {
      console.warn('[CREATE_ALBUM] Prevented duplicate submit while busy.');
      return;
    }

    setFormError(null);

    if (!albumName.trim()) {
      setFormError('Nama Album / Acara wajib diisi.');
      return;
    }
    if (!clientName.trim()) {
      setFormError('Nama Pelanggan wajib diisi.');
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        albumName: albumName.trim(),
        clientName: clientName.trim(),
        eventName: eventName.trim() || albumName.trim(),
        eventDate,
        pin: isPinEnabled ? pin.trim() : '',
        isPinEnabled: isPinEnabled && Boolean(pin.trim()),
        expirationDays,
        expirationAction,
      });

      // Reset form on success
      setAlbumName('');
      setClientName('');
      setEventName('');
      setPin(generateDefaultPin());
      setFormError(null);
      onClose();
    } catch (err: any) {
      console.error('[CREATE_ALBUM_MODAL] Error submitting album:', err);
      setFormError(err?.message || 'Terjadi kesalahan saat membuat album.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isBusy ? () => {} : onClose}
      title="Buat Album Pelanggan Baru"
      subtitle="Membuat folder Google Drive, Gallery ID unik, dan QR Code otomatis"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Nama Album / Acara */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Nama Album / Acara <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            disabled={isBusy}
            placeholder="Contoh: Wedding Dimas & Anisa, Prewedding Bali, Wisuda S1"
            value={albumName}
            onChange={(e) => setAlbumName(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        {/* Nama Pelanggan & Tanggal Acara */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Nama Pelanggan <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={isBusy}
              placeholder="Contoh: Kak Dimas Pratama"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Tanggal Acara
            </label>
            <input
              type="date"
              disabled={isBusy}
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* PIN Keamanan Galeri */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-800">Proteksi PIN Galeri</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                disabled={isBusy}
                checked={isPinEnabled}
                onChange={(e) => setIsPinEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {isPinEnabled && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                disabled={isBusy}
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="4 Digit PIN"
                className="w-32 px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono tracking-widest font-bold text-slate-800 text-center focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              />
              <button
                type="button"
                disabled={isBusy}
                onClick={handleRegeneratePin}
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-medium transition-all disabled:opacity-60"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Acak PIN
              </button>
              <span className="text-[11px] text-slate-500 ml-2">
                Pelanggan harus memasukkan PIN ini sebelum melihat foto.
              </span>
            </div>
          )}
        </div>

        {/* Masa Berlaku & Tindakan Kedaluwarsa */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Masa Berlaku Galeri
            </label>
            <select
              disabled={isBusy}
              value={expirationDays}
              onChange={(e) => setExpirationDays(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
            >
              <option value={7}>7 Hari</option>
              <option value={14}>14 Hari</option>
              <option value={30}>30 Hari (1 Bulan)</option>
              <option value={60}>60 Hari (2 Bulan)</option>
              <option value={90}>90 Hari (3 Bulan)</option>
              <option value={180}>180 Hari (6 Bulan)</option>
              <option value={365}>365 Hari (1 Tahun)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Tindakan Setelah Kedaluwarsa
            </label>
            <select
              disabled={isBusy}
              value={expirationAction}
              onChange={(e) => setExpirationAction(e.target.value as ExpirationAction)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
            >
              <option value="disable">Nonaktifkan Galeri (Kunci Akses)</option>
              <option value="trash">Pindahkan ke Keranjang Sampah</option>
            </select>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all disabled:opacity-50"
          >
            Batal
          </button>

          <button
            type="submit"
            disabled={isBusy}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            {isBusy ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Membuat Folder & Database...
              </>
            ) : (
              <>
                <FolderPlus className="w-4 h-4" />
                Buat Album & Gallery ID
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
