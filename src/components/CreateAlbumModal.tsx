import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Calendar, 
  Lock, 
  HardDrive, 
  Zap, 
  Clock, 
  Check
} from 'lucide-react';
import { Album, UserAccount, StudioProfile } from '../types';
import { createAlbumDriveFolder } from '../services/googleDrive';
import { getStoredUserToken } from '../services/googleAuth';
import { AlbumExpirySettings, calculateExpiryPreset } from './AlbumExpirySettings';

interface CreateAlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserAccount | null;
  studioProfile?: StudioProfile;
  onCreateAlbum: (albumData: any) => Promise<Album>;
  onSuccess: (album: Album) => void;
}

export const CreateAlbumModal: React.FC<CreateAlbumModalProps> = ({
  isOpen,
  onClose,
  user,
  onCreateAlbum,
  onSuccess,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [password, setPassword] = useState('');
  
  // Expiry states (Default Nonaktif)
  const [isExpiryEnabled, setIsExpiryEnabled] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [expiryAction, setExpiryAction] = useState<'disable' | 'trash'>('disable');

  const [displayQuality, setDisplayQuality] = useState<'hd' | 'light'>('hd');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quick PIN generator helper functions
  const generateRandom4DigitPin = (): string => {
    const val = Math.floor(Math.random() * 10000);
    return val.toString().padStart(4, '0');
  };

  const generateRandom6DigitPin = (): string => {
    const val = Math.floor(Math.random() * 1000000);
    return val.toString().padStart(6, '0');
  };

  const getEventYearPin = (dateStr: string): string => {
    if (dateStr) {
      const yearMatch = dateStr.match(/\b\d{4}\b/);
      if (yearMatch) return yearMatch[0];
    }
    return new Date().getFullYear().toString();
  };

  const handleTogglePasswordProtection = (checked: boolean) => {
    setIsPasswordProtected(checked);
    if (checked && !password.trim()) {
      setPassword(generateRandom4DigitPin());
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !eventName.trim()) {
      setErrorMessage('Nama pelanggan dan nama acara wajib diisi.');
      return;
    }

    if (isPasswordProtected && !password.trim()) {
      setErrorMessage('PIN / Password wajib diisi jika proteksi password/PIN aktif.');
      return;
    }

    if (isExpiryEnabled) {
      if (!expiresAt) {
        setErrorMessage('Tanggal & Waktu Berakhir masa berlaku galeri wajib diisi.');
        return;
      }
      const expDate = new Date(expiresAt);
      if (isNaN(expDate.getTime()) || expDate <= new Date()) {
        setErrorMessage('Tanggal dan waktu berakhir harus berada setelah waktu saat ini.');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let driveFolderId: string | undefined = undefined;
      let driveFolderUrl: string | undefined = undefined;

      // If user has active Google Drive token, create real Drive folder
      if (user?.isConnectedToDrive) {
        const token = getStoredUserToken(user.id) || user.accessToken;
        if (token && user.driveAlbumFolderId) {
          try {
            const folderTitle = `${eventName.trim()} - ${customerName.trim()}`;
            const driveFolder = await createAlbumDriveFolder(token, folderTitle, user.driveAlbumFolderId);
            driveFolderId = driveFolder.id;
            driveFolderUrl = driveFolder.webViewLink;
          } catch (driveErr: any) {
            console.warn('Could not create folder directly in Google Drive API:', driveErr.message);
            driveFolderId = `drive_folder_${Date.now()}`;
          }
        } else {
          driveFolderId = `drive_folder_${Date.now()}`;
        }
      } else {
        driveFolderId = `mock_drive_folder_${Date.now()}`;
      }

      const newAlbum = await onCreateAlbum({
        customerName: customerName.trim(),
        eventName: eventName.trim(),
        eventDate: eventDate,
        description: description.trim(),
        isPasswordProtected: isPasswordProtected && password.trim().length > 0,
        passwordHash: isPasswordProtected ? password.trim() : undefined,
        pinEnabled: isPasswordProtected && password.trim().length > 0,
        pinHash: isPasswordProtected ? password.trim() : undefined,
        expiresAt: isExpiryEnabled && expiresAt ? new Date(expiresAt).toISOString() : undefined,
        expiryAction: isExpiryEnabled ? expiryAction : undefined,
        displayQuality: displayQuality,
        driveFolderId: driveFolderId,
        driveFolderUrl: driveFolderUrl,
      });

      // Reset form
      setCustomerName('');
      setEventName('');
      setDescription('');
      setIsPasswordProtected(false);
      setPassword('');
      setIsExpiryEnabled(false);
      setExpiresAt('');
      setExpiryAction('disable');
      setDisplayQuality('hd');

      onSuccess(newAlbum);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal membuat album baru.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-xs text-white font-bold bg-blue-600"
            >
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Buat Album Pelanggan Baru</h3>
              <p className="text-xs text-slate-500">
                Otomatis membuat folder Google Drive & QR Code galeri instan
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
              {errorMessage}
            </div>
          )}

          {/* Customer & Event Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Nama Pelanggan / Klien <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Contoh: Andi & Sinta"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Nama Acara / Sesi Foto <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Contoh: Wedding Ceremony & Resepsi"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Event Date */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              Tanggal Acara
            </label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Deskripsi / Catatan Acara (Opsional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Lokasi Glass House Ayana Resort Bali. Dokumentasi lengkap pemberkatan dan malam resepsi."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition resize-none"
            />
          </div>

          {/* Password Protection */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-700 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-900">Proteksi Password / PIN Galeri</p>
                  <p className="text-[11px] text-slate-500">
                    Pelanggan harus memasukkan PIN sebelum dapat melihat foto.
                  </p>
                </div>
              </div>

              <input
                type="checkbox"
                checked={isPasswordProtected}
                onChange={(e) => handleTogglePasswordProtection(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded bg-white border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
            </div>

            {isPasswordProtected && (
              <div className="pt-2.5 space-y-3 border-t border-slate-200/70 animate-in fade-in duration-150">
                {/* Pilihan Cepat PIN */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-600 block">
                    Pilihan Cepat
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPassword(generateRandom4DigitPin())}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs hover:border-slate-400 flex items-center gap-1.5 transition cursor-pointer active:scale-95 shrink-0"
                      title="Buat PIN acak 4 digit baru"
                    >
                      <span>🎲</span>
                      <span>Acak 4 Digit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPassword(generateRandom6DigitPin())}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs hover:border-slate-400 flex items-center gap-1.5 transition cursor-pointer active:scale-95 shrink-0"
                      title="Buat PIN acak 6 digit baru"
                    >
                      <span>🎲</span>
                      <span>Acak 6 Digit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPassword(getEventYearPin(eventDate))}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs hover:border-slate-400 flex items-center gap-1.5 transition cursor-pointer active:scale-95 shrink-0"
                      title={`Gunakan tahun dari tanggal acara (${getEventYearPin(eventDate)})`}
                    >
                      <span>📅</span>
                      <span>Tahun Acara</span>
                    </button>
                  </div>
                </div>

                {/* Kolom Input PIN / Password */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700">
                    PIN / Password
                  </label>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan PIN / Password"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono font-bold tracking-wider text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition shadow-2xs"
                  />
                  <p className="text-[10px] text-slate-500">
                    Pilihan Cepat hanya membantu mengisi kolom. Anda tetap dapat mengetik PIN secara manual.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Masa Berlaku Galeri (Opsional) */}
          <AlbumExpirySettings
            isExpiryEnabled={isExpiryEnabled}
            expiresAt={expiresAt}
            expiryAction={expiryAction}
            onChange={(updates) => {
              if (updates.isExpiryEnabled !== undefined) setIsExpiryEnabled(updates.isExpiryEnabled);
              if (updates.expiresAt !== undefined) setExpiresAt(updates.expiresAt);
              if (updates.expiryAction !== undefined) setExpiryAction(updates.expiryAction);
            }}
          />

          {/* Quality Mode */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Kualitas Tampilan Default Pelanggan
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDisplayQuality('hd')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  displayQuality === 'hd'
                    ? 'bg-blue-50 border-blue-200 text-blue-900 shadow-2xs font-semibold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs">HD / Resolusi Tinggi</span>
                  {displayQuality === 'hd' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </div>
                <span className={`text-[10px] ${displayQuality === 'hd' ? 'text-blue-700' : 'text-slate-500'}`}>
                  Tampilan jernih untuk cetak & layar besar.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDisplayQuality('light')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  displayQuality === 'light'
                    ? 'bg-blue-50 border-blue-200 text-blue-900 shadow-2xs font-semibold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-500" /> Ringan / Hemat Kuota
                  </span>
                  {displayQuality === 'light' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </div>
                <span className={`text-[10px] ${displayQuality === 'light' ? 'text-blue-700' : 'text-slate-500'}`}>
                  Loading instan untuk koneksi seluler pelanggan.
                </span>
              </button>
            </div>
          </div>

          {/* Info Card */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-xs text-slate-600">
            <HardDrive className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p>
              Folder album akan otomatis dibuat di Google Drive studio:{' '}
              <strong className="text-slate-900 font-semibold">GaleriFotoQR / Album Pelanggan</strong>.
            </p>
          </div>

          {/* Submit Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition transform active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <span>Membuat Folder & QR...</span>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Buat Album & Generate QR</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
