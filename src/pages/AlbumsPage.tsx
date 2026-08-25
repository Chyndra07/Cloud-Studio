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
} from 'lucide-react';
import { Album, StudioProfile } from '../types';
import { getPublicGalleryUrl } from '../config/appConfig';

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
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Edit Modal State
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [editName, setEditName] = useState('');
  const [editClient, setEditClient] = useState('');
  const [editPin, setEditPin] = useState('');
  const [editPinEnabled, setEditPinEnabled] = useState(false);

  const handleCopyLink = (galleryId: string) => {
    const url = getPublicGalleryUrl(galleryId);
    navigator.clipboard.writeText(url);
    setCopyFeedback(galleryId);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const getRemainingDays = (expDateString: string) => {
    const diff = new Date(expDateString).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  const filteredAlbums = albums.filter((album) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      album.albumName.toLowerCase().includes(q) ||
      album.clientName.toLowerCase().includes(q) ||
      album.galleryId.toLowerCase().includes(q) ||
      (album.eventName && album.eventName.toLowerCase().includes(q));

    const isPast = new Date(album.expirationDate).getTime() < Date.now();
    const isExpired = album.status === 'expired' || isPast;

    if (statusFilter === 'active') return matchesSearch && !isExpired && album.status === 'active';
    if (statusFilter === 'expired') return matchesSearch && isExpired;
    return matchesSearch;
  });

  const handleStartEdit = (album: Album) => {
    setEditingAlbum(album);
    setEditName(album.albumName);
    setEditClient(album.clientName);
    setEditPin(album.pin || '');
    setEditPinEnabled(album.isPinEnabled);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAlbum) return;

    const updated: Album = {
      ...editingAlbum,
      albumName: editName.trim(),
      clientName: editClient.trim(),
      pin: editPin.trim(),
      isPinEnabled: editPinEnabled && Boolean(editPin.trim()),
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
            onClick={() => setStatusFilter('expired')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === 'expired'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Kedaluwarsa
          </button>
        </div>
      </div>

      {/* Albums Grid */}
      {filteredAlbums.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <FolderKanban className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">Tidak Ada Album Ditemukan</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            {searchQuery
              ? `Tidak ada album yang cocok dengan pencarian "${searchQuery}".`
              : 'Belum ada album pada kategori ini. Silakan buat album baru.'}
          </p>
          <button
            onClick={onOpenCreateAlbum}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            + Buat Album Baru
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredAlbums.map((album) => {
            const daysLeft = getRemainingDays(album.expirationDate);
            const isExpired = daysLeft <= 0 || album.status === 'expired';

            return (
              <div
                key={album.albumId}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
              >
                {/* Cover & Gallery ID Header */}
                <div className="relative aspect-[16/9] bg-slate-100 overflow-hidden">
                  {album.coverPhotoUrl || album.photos?.[0]?.thumbnailUrl ? (
                    <img
                      src={album.coverPhotoUrl || album.photos?.[0]?.thumbnailUrl}
                      alt={album.albumName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
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

                    {isExpired ? (
                      <span className="inline-flex items-center gap-1 bg-amber-500/95 backdrop-blur-md text-white text-[11px] font-bold px-2 py-0.5 rounded-lg shadow-sm">
                        <Clock className="w-3 h-3" /> Kedaluwarsa
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
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Edit Informasi Album</h3>
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

              <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Proteksi PIN</span>
                  <input
                    type="checkbox"
                    checked={editPinEnabled}
                    onChange={(e) => setEditPinEnabled(e.target.checked)}
                    className="w-4 h-4 accent-blue-600"
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

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingAlbum(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm"
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
