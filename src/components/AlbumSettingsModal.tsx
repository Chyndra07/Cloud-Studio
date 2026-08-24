import React, { useState, useEffect } from 'react';
import { 
  X, 
  Lock, 
  Unlock, 
  Calendar, 
  Clock, 
  Trash2, 
  Save, 
  Eye, 
  EyeOff, 
  Check, 
  Copy, 
  ExternalLink, 
  AlertTriangle, 
  ShieldCheck, 
  Info, 
  Sparkles,
  Settings,
  User,
  FileText,
  Sliders
} from 'lucide-react';
import { Album, StudioProfile } from '../types';
import { getPublicGalleryUrl } from '../services/urlHelper';
import { AlbumExpirySettings, formatLocalDateTime, calculateExpiryPreset } from './AlbumExpirySettings';

interface AlbumSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  album: Album | null;
  studioProfile: StudioProfile;
  onUpdateAlbum: (albumId: string, updates: Partial<Album>) => Promise<void> | void;
  onMoveToTrash: (albumId: string) => void;
}

export const AlbumSettingsModal: React.FC<AlbumSettingsModalProps> = ({
  isOpen,
  onClose,
  album,
  studioProfile,
  onUpdateAlbum,
  onMoveToTrash,
}) => {
  // Active Tab: 'password' | 'expiry' | 'info'
  const [activeTab, setActiveTab] = useState<'password' | 'expiry' | 'info'>('password');

  // Form states
  const [eventName, setEventName] = useState(album?.eventName || '');
  const [customerName, setCustomerName] = useState(album?.customerName || '');
  const [eventDate, setEventDate] = useState(album?.eventDate || '');
  const [description, setDescription] = useState(album?.description || '');
  const [displayQuality, setDisplayQuality] = useState<'hd' | 'light'>(album?.displayQuality || 'hd');

  // Password Protection states
  const [isPasswordProtected, setIsPasswordProtected] = useState<boolean>(
    Boolean(album?.isPasswordProtected || album?.pinEnabled)
  );
  const [passwordInput, setPasswordInput] = useState<string>(
    album?.passwordHash || album?.pinHash || ''
  );
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Expiry states
  const [isExpiryEnabled, setIsExpiryEnabled] = useState<boolean>(Boolean(album?.expiresAt));
  const [expiresAt, setExpiresAt] = useState<string>(() => {
    if (album?.expiresAt) {
      try {
        const d = new Date(album.expiresAt);
        return formatLocalDateTime(d);
      } catch {
        return '';
      }
    }
    return calculateExpiryPreset(30);
  });
  const [expiryAction, setExpiryAction] = useState<'disable' | 'trash'>(
    album?.expiryAction || 'disable'
  );

  // UI feedback states
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [showTrashConfirm, setShowTrashConfirm] = useState(false);

  // Re-sync with album props if changed
  useEffect(() => {
    if (album) {
      setEventName(album.eventName || '');
      setCustomerName(album.customerName || '');
      setEventDate(album.eventDate || '');
      setDescription(album.description || '');
      setDisplayQuality(album.displayQuality || 'hd');
      setIsPasswordProtected(Boolean(album.isPasswordProtected || album.pinEnabled));
      setPasswordInput(album.passwordHash || album.pinHash || '');
      setIsExpiryEnabled(Boolean(album.expiresAt));
      if (album.expiresAt) {
        try {
          const d = new Date(album.expiresAt);
          setExpiresAt(formatLocalDateTime(d));
        } catch {
          setExpiresAt('');
        }
      }
      setExpiryAction(album.expiryAction || 'disable');
      setShowTrashConfirm(false);
      setSaveSuccess(false);
    }
  }, [album]);

  if (!isOpen || !album) return null;

  const publicGalleryUrl = getPublicGalleryUrl(album.galleryId, studioProfile.customGalleryDomain);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicGalleryUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(album.galleryId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const generateRandomPin = (digits: number) => {
    const random = Math.floor(Math.random() * Math.pow(10, digits))
      .toString()
      .padStart(digits, '0');
    setPasswordInput(random);
    setIsPasswordProtected(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isExpiryEnabled) {
      if (!expiresAt) {
        alert('Tanggal & Waktu Berakhir masa berlaku galeri wajib diisi.');
        return;
      }
      const expDate = new Date(expiresAt);
      if (isNaN(expDate.getTime()) || expDate <= new Date()) {
        alert('Tanggal dan waktu berakhir harus berada setelah waktu saat ini.');
        return;
      }
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const updates: Partial<Album> = {
        eventName: eventName.trim() || 'Acara Foto',
        customerName: customerName.trim() || 'Pelanggan',
        eventDate: eventDate || new Date().toISOString().split('T')[0],
        description: description.trim(),
        displayQuality,
        isPasswordProtected: isPasswordProtected,
        pinEnabled: isPasswordProtected,
        passwordHash: isPasswordProtected ? passwordInput.trim() : '',
        pinHash: isPasswordProtected ? passwordInput.trim() : '',
        expiresAt: isExpiryEnabled && expiresAt ? new Date(expiresAt).toISOString() : undefined,
        expiryAction: isExpiryEnabled ? expiryAction : undefined,
      };

      await onUpdateAlbum(album.id, updates);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 900);
    } catch (err: any) {
      alert(`Gagal menyimpan pengaturan: ${err.message || 'Terjadi kesalahan'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTrashConfirm = () => {
    onMoveToTrash(album.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-slate-100 bg-slate-50/70 flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
                <Settings className="w-4 h-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                Pengaturan & Keamanan Album
              </h2>
            </div>
            
            {/* Dynamic Active Album Name */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 pl-10">
              <span className="font-semibold text-slate-900 truncate">
                {album.customerName || 'Pelanggan'} • {album.eventName}
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-white border border-slate-200 text-slate-700 font-bold">
                ID: {album.galleryId}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition cursor-pointer shrink-0"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 SEGMENTED TABS */}
        <div className="px-5 sm:px-7 pt-3 pb-2 border-b border-slate-100 bg-white">
          <div className="grid grid-cols-3 p-1 bg-slate-100/90 rounded-xl text-xs font-semibold gap-1">
            
            {/* Tab 1: Password Protection */}
            <button
              type="button"
              onClick={() => setActiveTab('password')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition cursor-pointer ${
                activeTab === 'password'
                  ? 'bg-white text-blue-700 shadow-2xs font-bold border border-slate-200/70'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Lock className={`w-3.5 h-3.5 ${activeTab === 'password' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span className="truncate">Password Protection</span>
              {isPasswordProtected && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
              )}
            </button>

            {/* Tab 2: Masa Berlaku */}
            <button
              type="button"
              onClick={() => setActiveTab('expiry')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition cursor-pointer ${
                activeTab === 'expiry'
                  ? 'bg-white text-blue-700 shadow-2xs font-bold border border-slate-200/70'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Clock className={`w-3.5 h-3.5 ${activeTab === 'expiry' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span className="truncate">Masa Berlaku</span>
              {isExpiryEnabled && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
              )}
            </button>

            {/* Tab 3: Info & Sampah */}
            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition cursor-pointer ${
                activeTab === 'info'
                  ? 'bg-white text-blue-700 shadow-2xs font-bold border border-slate-200/70'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Info className={`w-3.5 h-3.5 ${activeTab === 'info' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span className="truncate">Info & Sampah</span>
            </button>
          </div>
        </div>

        {/* TAB CONTENTS (SCROLLABLE) */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 space-y-6">
          
          {/* ================= TAB 1: PASSWORD PROTECTION ================= */}
          {activeTab === 'password' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              
              {/* Toggle Switch Card */}
              <div className="bg-slate-50 border border-slate-200 p-4 sm:p-5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <label 
                      htmlFor="toggle-password-protection"
                      className="text-sm font-bold text-slate-900 cursor-pointer flex items-center gap-2"
                    >
                      <span>Aktifkan Password Protection</span>
                      {isPasswordProtected ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Aktif
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-200 text-slate-600">
                          Nonaktif
                        </span>
                      )}
                    </label>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Pengunjung galeri yang memindai QR Code atau membuka tautan wajib memasukkan PIN untuk melihat foto.
                    </p>
                  </div>

                  {/* Toggle Button */}
                  <button
                    type="button"
                    id="toggle-password-protection"
                    role="switch"
                    aria-checked={isPasswordProtected}
                    onClick={() => {
                      const next = !isPasswordProtected;
                      setIsPasswordProtected(next);
                      if (next && !passwordInput) {
                        setPasswordInput('1234');
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isPasswordProtected ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isPasswordProtected ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* PIN / Password Input Field */}
              {isPasswordProtected ? (
                <div className="space-y-3 p-4 sm:p-5 bg-blue-50/50 border border-blue-200/80 rounded-2xl">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      PIN / Password Akses Pelanggan
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Contoh: 1234 atau nama acara..."
                        required={isPasswordProtected}
                        className="w-full pl-4 pr-12 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono tracking-wider text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition shadow-2xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                        title={showPassword ? 'Sembunyikan' : 'Tampilkan'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      Gunakan 4–8 angka atau kombinasi huruf agar mudah diingat pelanggan.
                    </p>
                  </div>

                  {/* Quick Generator Chips */}
                  <div className="pt-2 border-t border-blue-100 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-600">Pilihan Cepat:</span>
                    <button
                      type="button"
                      onClick={() => generateRandomPin(4)}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold transition cursor-pointer shadow-2xs hover:border-slate-400 flex items-center gap-1 shrink-0"
                    >
                      <span>🎲</span>
                      <span>Acak 4 Digit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => generateRandomPin(6)}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold transition cursor-pointer shadow-2xs hover:border-slate-400 flex items-center gap-1 shrink-0"
                    >
                      <span>🎲</span>
                      <span>Acak 6 Digit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const eventDateStr = eventDate || album.eventDate;
                        const match = eventDateStr ? eventDateStr.match(/\b\d{4}\b/) : null;
                        const year = match ? match[0] : new Date().getFullYear().toString();
                        setPasswordInput(year);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold transition cursor-pointer shadow-2xs hover:border-slate-400 flex items-center gap-1 shrink-0"
                    >
                      <span>📅</span>
                      <span>Tahun Acara</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3">
                  <Unlock className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Galeri Terbuka untuk Umum</h4>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Siapa saja yang memiliki link atau memindai QR Code galeri ini dapat langsung melihat dan mengunduh foto tanpa memasukkan PIN.
                    </p>
                  </div>
                </div>
              )}

              {/* Security Notice */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-start gap-3 text-xs text-emerald-900">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-emerald-950">Validasi Keamanan Terpusat</p>
                  <p className="text-emerald-800/90 leading-relaxed text-[11px]">
                    PIN diverifikasi secara aman oleh server. PIN tidak disematkan dalam URL QR Code sehingga privasi pelanggan tetap terjaga.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: MASA BERLAKU ================= */}
          {activeTab === 'expiry' && (
            <div className="space-y-4 animate-in fade-in duration-150">
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
            </div>
          )}

          {/* ================= TAB 3: INFO & SAMPAH ================= */}
          {activeTab === 'info' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              
              {/* Form Input Data Album */}
              <div className="bg-slate-50 border border-slate-200 p-4 sm:p-5 rounded-2xl space-y-3.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Informasi Detail Album
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Acara / Judul Galeri
                    </label>
                    <input
                      type="text"
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                      required
                      placeholder="Contoh: Wedding Ryan & Siti"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-500 transition shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Klien / Pelanggan
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      required
                      placeholder="Contoh: Ryan & Siti"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-500 transition shadow-2xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tanggal Acara
                    </label>
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-500 transition shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Kualitas Tampilan Foto
                    </label>
                    <select
                      value={displayQuality}
                      onChange={(e) => setDisplayQuality(e.target.value as 'hd' | 'light')}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-500 transition shadow-2xs"
                    >
                      <option value="hd">HD Premium Quality</option>
                      <option value="light">Light Mode (Hemat Kuota Pelanggan)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Deskripsi / Catatan Tambahan (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Catatan untuk pelanggan atau tim..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-500 transition shadow-2xs"
                  />
                </div>
              </div>

              {/* Public Link & ID Details */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Tautan & Identitas Galeri
                </h3>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-white border border-slate-200 rounded-xl">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-slate-400 block font-semibold">Tautan Galeri Publik</span>
                    <p className="text-xs text-slate-800 font-mono truncate">{publicGalleryUrl}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Tersalin' : 'Salin'}</span>
                    </button>
                    <a
                      href={publicGalleryUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                      title="Buka Halaman Galeri"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Danger Zone: Soft Delete / Move to Trash */}
              <div className="bg-rose-50/70 border border-rose-200 p-4 sm:p-5 rounded-2xl space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <h4 className="text-xs font-bold text-rose-950">
                      Pindahkan Album ke Keranjang Sampah
                    </h4>
                    <p className="text-xs text-rose-800 leading-relaxed">
                      Album tidak dapat diakses pelanggan lewat QR Code atau link publik. File foto di Google Drive tetap aman dan album dapat dipulihkan sewaktu-waktu dari menu Keranjang Sampah.
                    </p>
                  </div>
                </div>

                {showTrashConfirm ? (
                  <div className="p-3 bg-white border border-rose-300 rounded-xl space-y-2 animate-in fade-in">
                    <p className="text-xs font-bold text-rose-900">
                      Konfirmasi: Pindahkan album &quot;{album.eventName}&quot; ke keranjang sampah?
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleTrashConfirm}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer shadow-2xs"
                      >
                        Ya, Pindahkan ke Sampah
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowTrashConfirm(false)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                      >
                        Batalkan
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowTrashConfirm(true)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 text-xs font-bold transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-rose-700" />
                    <span>Pindahkan ke Keranjang Sampah</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* MODAL FOOTER ACTIONS */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition cursor-pointer"
            >
              Tutup
            </button>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs transition transform active:scale-95 cursor-pointer ${
                  saveSuccess
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Tersimpan!</span>
                  </>
                ) : (
                  <>
                    <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                    <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
