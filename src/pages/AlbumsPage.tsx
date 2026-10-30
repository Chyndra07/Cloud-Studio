import React, { useState } from 'react';
import {
  FolderKanban,
  Search,
  Plus,
  QrCode,
  Copy,
  ExternalLink,
  Upload,
  Trash2,
  Edit,
  Shield,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  Image as ImageIcon,
  Hourglass,
  CalendarDays,
  Sparkles,
  Sliders,
  Check,
} from 'lucide-react';
import { Album, StudioProfile } from '../types';
import { getPublicGalleryUrl } from '../config/appConfig';

/**
 * Format Date to YYYY-MM-DDTHH:mm in local time for datetime-local inputs
 */
const formatLocalDateTime = (date: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Format ISO date string into readable Indonesian date format
 */
const formatReadableDate = (dateString: string): string => {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
};

interface AlbumsPageProps {
  albums: Album[];
  profile: StudioProfile | null;
  onOpenCreateAlbum: () => void;
  onOpenQR: (album: Album) => void;
  onOpenAlbumDetail: (album: Album) => void;
  onTrashAlbum: (albumId: string) => void;
  onUpdateAlbum: (album: Album) => Promise<void>;
}

export const AlbumsPage: React.FC<AlbumsPageProps> = ({
  albums,
  profile,
  onOpenCreateAlbum,
  onOpenQR,
  onOpenAlbumDetail,
  onTrashAlbum,
  onUpdateAlbum,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expiring_soon' | 'expired'>('all');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Edit Modal State
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [editName, setEditName] = useState('');
  const [editClient, setEditClient] = useState('');
  const [editPin, setEditPin] = useState('');
  const [editPinEnabled, setEditPinEnabled] = useState(false);
  const [editExpirationDate, setEditExpirationDate] = useState('');
  const [isCustomDatePickerOpen, setIsCustomDatePickerOpen] = useState(false);

  const handleCopyLink = (galleryId: string) => {
    const url = getPublicGalleryUrl(galleryId);
    navigator.clipboard.writeText(url);
    setCopyFeedback(galleryId);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const getRemainingDays = (expDateString: string) => {
    if (!expDateString) return 0;
    const diff = new Date(expDateString).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  /**
   * Status kalkulasi album:
   * - 'expired': sisa <= 0 hari
   * - 'expiring_soon': sisa > 0 dan <= 3 hari
   * - 'active': sisa > 3 hari
   */
  const getAlbumExpiryStatus = (expDateString: string): 'active' | 'expiring_soon' | 'expired' => {
    if (!expDateString) return 'expired';
    const diff = new Date(expDateString).getTime() - Date.now();
    if (diff <= 0) return 'expired';
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    if (diff <= threeDaysMs) return 'expiring_soon';
    return 'active';
  };

  const filteredAlbums = albums.filter((album) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      album.albumName.toLowerCase().includes(q) ||
      album.clientName.toLowerCase().includes(q) ||
      album.galleryId.toLowerCase().includes(q) ||
      (album.eventName && album.eventName.toLowerCase().includes(q));

    const expiryStatus = getAlbumExpiryStatus(album.expirationDate);

    if (statusFilter === 'active') return matchesSearch && expiryStatus === 'active';
    if (statusFilter === 'expiring_soon') return matchesSearch && expiryStatus === 'expiring_soon';
    if (statusFilter === 'expired') return matchesSearch && expiryStatus === 'expired';
    return matchesSearch;
  });

  const handleStartEdit = (album: Album) => {
    setEditingAlbum(album);
    setEditName(album.albumName);
    setEditClient(album.clientName);
    setEditPin(album.pin || '');
    setEditPinEnabled(album.isPinEnabled);
    setIsCustomDatePickerOpen(false);

    // Inisialisasi tanggal kedaluwarsa
    if (album.expirationDate) {
      try {
        const d = new Date(album.expirationDate);
        if (!isNaN(d.getTime())) {
          setEditExpirationDate(formatLocalDateTime(d));
        } else {
          setEditExpirationDate(formatLocalDateTime(new Date(Date.now() + 30 * 86400000)));
        }
      } catch {
        setEditExpirationDate(formatLocalDateTime(new Date(Date.now() + 30 * 86400000)));
      }
    } else {
      setEditExpirationDate(formatLocalDateTime(new Date(Date.now() + 30 * 86400000)));
    }
  };

  /**
   * Logika Penambahan Masa Aktif:
   * - Tambahkan N hari dari tanggal kedaluwarsa yang sedang berlaku.
   * - Jika album sudah kedaluwarsa, perpanjangan dihitung mulai dari tanggal dan waktu saat ini (NOW).
   * - Dapat diperpanjang berkali-kali secara kumulatif.
   */
  const handleAddDays = (daysToAdd: number) => {
    const nowMs = Date.now();
    let baseTime = nowMs;

    if (editExpirationDate) {
      const parsedTime = new Date(editExpirationDate).getTime();
      if (!isNaN(parsedTime) && parsedTime > nowMs) {
        // Jika masih aktif, tambahkan dari tanggal kedaluwarsa yang sedang berlaku
        baseTime = parsedTime;
      }
    }

    const newDate = new Date(baseTime + daysToAdd * 86400000);
    setEditExpirationDate(formatLocalDateTime(newDate));
  };

  // Live remaining time calculation in edit modal
  const editRemainingDays = editExpirationDate ? getRemainingDays(editExpirationDate) : 0;
  const editExpiryStatus = editExpirationDate ? getAlbumExpiryStatus(editExpirationDate) : 'expired';

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAlbum) return;

    let targetExpIso: string;
    if (editExpirationDate) {
      const parsedDate = new Date(editExpirationDate);
      targetExpIso = !isNaN(parsedDate.getTime())
        ? parsedDate.toISOString()
        : editingAlbum.expirationDate || new Date(Date.now() + 30 * 86400000).toISOString();
    } else {
      targetExpIso = editingAlbum.expirationDate || new Date(Date.now() + 30 * 86400000).toISOString();
    }

    const isPast = new Date(targetExpIso).getTime() < Date.now();
    const updatedStatus: 'active' | 'expired' | 'disabled' = isPast ? 'expired' : 'active';

    const updated: Album = {
      ...editingAlbum,
      albumName: editName.trim(),
      clientName: editClient.trim(),
      pin: editPin.trim(),
      isPinEnabled: editPinEnabled && Boolean(editPin.trim()),
      expirationDate: targetExpIso,
      status: updatedStatus,
      updatedAt: new Date().toISOString(),
    };

    await onUpdateAlbum(updated);
    setEditingAlbum(null);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Daftar Album Pelanggan</h2>
          <p className="text-xs text-slate-500">Kelola galeri, unggah foto Google Drive, dan generate QR Code</p>
        </div>

        <button
          onClick={onOpenCreateAlbum}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 active:scale-95 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          + Buat Album Baru
        </button>
      </div>

      {/* Filter Tabs & Search Box */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-2xl shadow-sm">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari album, nama klien, atau ID (GFQ-...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Semua ({albums.length})
          </button>

          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === 'active'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Aktif
          </button>

          <button
            onClick={() => setStatusFilter('expiring_soon')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === 'expiring_soon'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Segera Berakhir
          </button>

          <button
            onClick={() => setStatusFilter('expired')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === 'expired'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Kedaluwarsa
          </button>
        </div>
      </div>

      {/* Album Grid Cards */}
      {filteredAlbums.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto border border-slate-100">
            <FolderKanban className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">Tidak ada album ditemukan</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? `Tidak ada album yang cocok dengan pencarian "${searchQuery}".`
                : 'Mulai dengan membuat album baru untuk pelanggan studio Anda.'}
            </p>
          </div>
          {!searchQuery && (
            <button
              onClick={onOpenCreateAlbum}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Buat Album Sekarang
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 items-start">
          {filteredAlbums.map((album) => {
            const daysLeft = getRemainingDays(album.expirationDate);
            const expiryStatus = getAlbumExpiryStatus(album.expirationDate);

            return (
              <div
                key={album.albumId}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
              >
                {/* Cover & Gallery ID Header (Portrait 9:16) */}
                <div className="relative w-full aspect-[9/16] bg-slate-950 overflow-hidden flex items-center justify-center rounded-t-2xl shrink-0" style={{ aspectRatio: '9 / 16', width: '100%' }}>
                  {album.coverPhotoUrl || album.photos?.[0]?.thumbnailUrl ? (
                    <>
                      {/* Ambient blur backdrop for smooth uncropped aesthetic */}
                      <img
                        src={album.coverPhotoUrl || album.photos?.[0]?.thumbnailUrl}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 w-full h-full object-cover opacity-25 filter blur-lg scale-110 pointer-events-none"
                      />
                      {/* 100% Uncropped Photo with object-contain */}
                      <img
                        src={album.coverPhotoUrl || album.photos?.[0]?.thumbnailUrl}
                        alt={album.albumName}
                        className="relative z-10 max-w-full max-h-full w-full h-full transition-transform duration-300 group-hover:scale-[1.02]" style={{ objectFit: 'contain', objectPosition: 'center center' }}
                      />
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-100">
                      <ImageIcon className="w-10 h-10 mb-1 opacity-50" />
                      <span className="text-[11px] font-medium">Belum Ada Foto</span>
                    </div>
                  )}

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                    <span className="font-mono font-bold text-xs bg-slate-900/90 backdrop-blur-md text-white px-2.5 py-1 rounded-lg shadow-sm">
                      {album.galleryId}
                    </span>

                    {expiryStatus === 'expired' ? (
                      <span className="inline-flex items-center gap-1 bg-rose-600/95 backdrop-blur-md text-white text-[11px] font-bold px-2 py-0.5 rounded-lg shadow-sm">
                        <Clock className="w-3 h-3" /> Kedaluwarsa
                      </span>
                    ) : expiryStatus === 'expiring_soon' ? (
                      <span className="inline-flex items-center gap-1 bg-amber-500/95 backdrop-blur-md text-white text-[11px] font-bold px-2 py-0.5 rounded-lg shadow-sm animate-pulse">
                        <Hourglass className="w-3 h-3" /> Sisa {daysLeft} Hari (Segera Berakhir)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-emerald-600/95 backdrop-blur-md text-white text-[11px] font-bold px-2 py-0.5 rounded-lg shadow-sm">
                        <CheckCircle className="w-3 h-3" /> Sisa {daysLeft} Hari
                      </span>
                    )}
                  </div>

                  {/* Photo Count Pill */}
                  <div className="absolute bottom-3 left-3">
                    <span className="bg-black/60 backdrop-blur-sm text-white text-[11px] font-semibold px-2 py-1 rounded-md flex items-center gap-1">
                      📸 {album.photoCount || album.photos?.length || 0} Foto
                    </span>
                  </div>
                </div>

                {/* Album Details */}
                <div className="p-5 space-y-3 flex-1">
                  <div>
                    <h3
                      onClick={() => onOpenAlbumDetail(album)}
                      className="text-base font-bold text-slate-900 hover:text-blue-600 cursor-pointer transition-colors line-clamp-1"
                    >
                      {album.albumName}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">👤 Pelanggan: <span className="font-semibold text-slate-700">{album.clientName}</span></p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pt-1 border-t border-slate-100">
                    {album.eventDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {album.eventDate}
                      </span>
                    )}

                    {album.isPinEnabled && album.pin && (
                      <span className="flex items-center gap-1 font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded">
                        <Shield className="w-3 h-3 text-amber-600" />
                        PIN: {album.pin}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons Footer */}
                <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onOpenQR(album)}
                      title="QR Code & Download Kartu"
                      className="p-2 bg-white hover:bg-blue-50 hover:text-blue-600 text-slate-700 border border-slate-200 rounded-xl text-xs transition-colors shadow-sm"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleCopyLink(album.galleryId)}
                      title="Salin Tautan Galeri"
                      className={`p-2 rounded-xl text-xs transition-all border ${
                        copyFeedback === album.galleryId
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-sm'
                      }`}
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleStartEdit(album)}
                      title="Edit Album"
                      className="p-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs transition-colors shadow-sm"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Pindahkan album "${album.albumName}" ke keranjang sampah?`)) {
                          onTrashAlbum(album.albumId);
                        }
                      }}
                      title="Hapus / Pindahkan ke Sampah"
                      className="p-2 bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-400 border border-slate-200 rounded-xl text-xs transition-colors shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => onOpenAlbumDetail(album)}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                  >
                    Buka Album
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Album Modal */}
      {editingAlbum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Edit Informasi Album</h3>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                {editingAlbum.galleryId}
              </span>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nama Album</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nama Pelanggan</label>
                <input
                  type="text"
                  required
                  value={editClient}
                  onChange={(e) => setEditClient(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Proteksi PIN */}
              <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-blue-600" /> Proteksi PIN
                  </span>
                  <input
                    type="checkbox"
                    checked={editPinEnabled}
                    onChange={(e) => setEditPinEnabled(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 cursor-pointer"
                  />
                </div>
                {editPinEnabled && (
                  <input
                    type="text"
                    maxLength={8}
                    value={editPin}
                    onChange={(e) => setEditPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="PIN 4 Digit"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-center"
                  />
                )}
              </div>

              {/* [LENGKAP] Masa Aktif Album */}
              <div className="p-4 bg-slate-50/80 rounded-2xl space-y-3.5 border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-blue-600" />
                    <span>Masa Aktif Album</span>
                  </label>

                  {/* Status Badge */}
                  {editExpiryStatus === 'expired' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1 shadow-2xs">
                      <Clock className="w-3 h-3 text-rose-600" /> Kedaluwarsa
                    </span>
                  ) : editExpiryStatus === 'expiring_soon' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1 shadow-2xs animate-pulse">
                      <Hourglass className="w-3 h-3 text-amber-600" /> Segera Berakhir
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 shadow-2xs">
                      <CheckCircle className="w-3 h-3 text-emerald-600" /> Aktif
                    </span>
                  )}
                </div>

                {/* Ringkasan Parameter Masa Aktif */}
                <div className="p-3 bg-white rounded-xl border border-slate-200/90 text-xs space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-[11px]">Tanggal Mulai Masa Aktif:</span>
                    <span className="font-semibold text-slate-800">
                      {formatReadableDate(editingAlbum.createdAt || editingAlbum.eventDate || '')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-[11px]">Kedaluwarsa Sebelumnya:</span>
                    <span className="font-medium text-slate-700">
                      {formatReadableDate(editingAlbum.expirationDate)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-700">Kedaluwarsa Baru:</span>
                    <span className="font-bold text-blue-600">
                      {formatReadableDate(editExpirationDate)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-700">Sisa Masa Aktif:</span>
                    {editRemainingDays > 0 ? (
                      <span className={`font-bold ${editExpiryStatus === 'expiring_soon' ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {editRemainingDays} hari lagi
                      </span>
                    ) : (
                      <span className="font-bold text-rose-600">
                        Masa aktif habis
                      </span>
                    )}
                  </div>
                </div>

                {/* Pilihan Perpanjangan Masa Aktif Secara Cepat */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-700 block">
                    Pilihan Perpanjangan Cepat:
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddDays(7)}
                      title="Tambahkan 7 hari"
                      className="px-2.5 py-1.5 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition active:scale-95 shadow-2xs"
                    >
                      +7 Hari
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddDays(14)}
                      title="Tambahkan 14 hari"
                      className="px-2.5 py-1.5 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition active:scale-95 shadow-2xs"
                    >
                      +14 Hari
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddDays(30)}
                      title="Tambahkan 30 hari"
                      className="px-2.5 py-1.5 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition active:scale-95 shadow-2xs"
                    >
                      +30 Hari
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddDays(60)}
                      title="Tambahkan 60 hari"
                      className="px-2.5 py-1.5 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition active:scale-95 shadow-2xs"
                    >
                      +60 Hari
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddDays(90)}
                      title="Tambahkan 90 hari"
                      className="px-2.5 py-1.5 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition active:scale-95 shadow-2xs"
                    >
                      +90 Hari
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddDays(180)}
                      title="Tambahkan 180 hari"
                      className="px-2.5 py-1.5 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition active:scale-95 shadow-2xs"
                    >
                      +180 Hari
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCustomDatePickerOpen(!isCustomDatePickerOpen)}
                      className={`col-span-3 sm:col-span-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 shadow-2xs flex items-center justify-center gap-1.5 border ${
                        isCustomDatePickerOpen
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                      }`}
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>{isCustomDatePickerOpen ? 'Tutup Atur Sendiri' : 'Atur Sendiri'}</span>
                    </button>
                  </div>
                </div>

                {/* Mode Atur Sendiri (Date Picker) */}
                {isCustomDatePickerOpen && (
                  <div className="pt-2 border-t border-slate-200/80 space-y-1.5 animate-in fade-in duration-200">
                    <label className="block text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      <span>Tentukan Tanggal & Waktu Kedaluwarsa:</span>
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={editExpirationDate}
                      onChange={(e) => setEditExpirationDate(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingAlbum(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition active:scale-95"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

