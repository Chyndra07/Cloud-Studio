import React, { useState } from 'react';
import { 
  Images, 
  Search, 
  Plus, 
  QrCode, 
  ExternalLink, 
  Lock, 
  Unlock,
  Calendar, 
  User, 
  MoreVertical, 
  Trash2, 
  HardDrive, 
  FolderOpen, 
  FolderUp,
  Upload,
  Share2, 
  Copy, 
  Check, 
  Filter,
  Grid,
  List,
  Eye,
  Camera,
  Settings,
  ChevronDown
} from 'lucide-react';
import { Album, StudioProfile } from '../types';
import { getPublicGalleryUrl } from '../services/urlHelper';

interface AlbumListProps {
  albums: Album[];
  studioProfile: StudioProfile;
  onOpenCreateAlbum: () => void;
  onOpenUploadFolder?: () => void;
  onOpenUploadPhotos?: () => void;
  onSelectAlbum: (album: Album) => void;
  onOpenQRCode: (album: Album) => void;
  onOpenSettings?: (album: Album) => void;
  onMoveToTrash: (albumId: string) => Promise<void> | void;
  isDriveConnected?: boolean;
  onConnectDrive?: () => void;
}

// 4R Photo Print Format Album Cover Preview Component (Portrait 4:6 = 2:3, Landscape 6:4 = 3:2)
interface AlbumCoverPreview4RProps {
  album: Album;
  onCopyPin: (album: Album, e: React.MouseEvent) => void;
  copiedPinId: string | null;
}

const AlbumCoverPreview4R: React.FC<AlbumCoverPreview4RProps> = ({
  album,
  onCopyPin,
  copiedPinId,
}) => {
  const [isLandscape, setIsLandscape] = useState<boolean | null>(null);
  const [imageError, setImageError] = useState(false);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      // Auto-detect orientation: width > height => Landscape 6:4 (3:2), else Portrait 4:6 (2:3)
      setIsLandscape(img.naturalWidth > img.naturalHeight);
    }
  };

  // Frame aspect ratio:
  // - Landscape photo: 6:4 -> aspect-[3/2]
  // - Portrait / Square / Default / Empty: 4:6 -> aspect-[2/3]
  const aspectClass = isLandscape === true ? 'aspect-[3/2]' : 'aspect-[2/3]';

  return (
    <div
      className={`relative ${aspectClass} w-full bg-slate-900 overflow-hidden rounded-t-2xl flex items-center justify-center transition-all duration-300 select-none`}
    >
      {album.coverPhotoUrl && !imageError ? (
        <>
          {/* Subtle ambient backdrop for smooth aesthetic matte framing */}
          <img
            src={album.coverPhotoUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover opacity-20 filter blur-xl scale-125 pointer-events-none"
            referrerPolicy="no-referrer"
          />

          {/* 100% Full Uncropped Photo using object-contain - never crops face, head or body */}
          <img
            src={album.coverPhotoUrl}
            alt={album.eventName}
            onLoad={handleImageLoad}
            onError={() => setImageError(true)}
            className="relative z-1 max-w-full max-h-full w-full h-full object-contain transition-transform duration-500 group-hover:scale-[1.02]"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-100 p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-200/80 flex items-center justify-center mb-2.5 shadow-2xs">
            <Camera className="w-6 h-6 text-slate-500" />
          </div>
          <span className="text-xs font-semibold text-slate-600">Belum ada foto</span>
          <span className="text-[10px] text-slate-400 mt-1 font-mono">Format 4R (4:6)</span>
        </div>
      )}

      {/* Badges Overlay */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-2 pointer-events-none">
        {/* Photo Count Badge */}
        <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-900/85 backdrop-blur-md text-white border border-white/15 shadow-sm flex items-center gap-1.5 pointer-events-auto">
          <Images className="w-3 h-3 text-slate-300" />
          {album.photosCount} Foto
        </span>

        {/* PIN Badge (Click to Copy) */}
        {(album.isPasswordProtected || album.pinEnabled) && (album.passwordHash || album.pinHash) && (
          <button
            type="button"
            onClick={(e) => onCopyPin(album, e)}
            className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 border border-amber-300 shadow-sm flex items-center gap-1 transition active:scale-95 cursor-pointer pointer-events-auto"
            title="Klik untuk salin PIN ke clipboard"
          >
            <Lock className="w-3 h-3 text-slate-950 shrink-0" />
            <span className="font-mono font-bold">
              {copiedPinId === album.id ? 'Tersalin!' : `PIN: ${album.passwordHash || album.pinHash}`}
            </span>
          </button>
        )}
      </div>

      {/* Gallery Slug ID Badge */}
      <div className="absolute bottom-2.5 right-2.5 z-10 pointer-events-none">
        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900/85 backdrop-blur-md text-slate-200 font-bold border border-white/15 shadow-sm">
          {album.galleryId}
        </span>
      </div>
    </div>
  );
};

export const AlbumList: React.FC<AlbumListProps> = ({
  albums,
  studioProfile,
  onOpenCreateAlbum,
  onOpenUploadFolder,
  onOpenUploadPhotos,
  onSelectAlbum,
  onOpenQRCode,
  onOpenSettings,
  onMoveToTrash,
  isDriveConnected = true,
  onConnectDrive,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'locked' | 'unlocked'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedPinId, setCopiedPinId] = useState<string | null>(null);
  const [copiedPinToast, setCopiedPinToast] = useState<string | null>(null);
  const [showMobileActionMenu, setShowMobileActionMenu] = useState(false);
  const [albumToDelete, setAlbumToDelete] = useState<Album | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteToast, setDeleteToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const openDeleteConfirmation = (album: Album, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setAlbumToDelete(album);
  };

  const handleConfirmDelete = async () => {
    if (!albumToDelete) return;
    setIsDeleting(true);
    try {
      await onMoveToTrash(albumToDelete.id);
      setAlbumToDelete(null);
      setDeleteToast({
        type: 'success',
        message: 'Album berhasil dipindahkan ke Keranjang Sampah.',
      });
      setTimeout(() => {
        setDeleteToast((current) => (current?.type === 'success' ? null : current));
      }, 3500);
    } catch (err: any) {
      console.error('Gagal memindahkan album ke Keranjang Sampah:', err);
      setDeleteToast({
        type: 'error',
        message: 'Gagal memindahkan album ke Keranjang Sampah. Silakan coba lagi.',
      });
      setTimeout(() => {
        setDeleteToast((current) => (current?.type === 'error' ? null : current));
      }, 4000);
    } finally {
      setIsDeleting(false);
    }
  };

  const activeAlbums = albums.filter((a) => !a.isDeleted);

  const filteredAlbums = activeAlbums.filter((album) => {
    const matchesSearch =
      album.eventName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      album.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      album.galleryId.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    const isLocked = Boolean(album.isPasswordProtected || album.pinEnabled);
    if (filterType === 'locked') return isLocked;
    if (filterType === 'unlocked') return !isLocked;

    return true;
  });

  const handleCopyLink = (album: Album, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = getPublicGalleryUrl(album.galleryId, studioProfile.customGalleryDomain);
    navigator.clipboard.writeText(url);
    setCopiedId(album.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyPin = (album: Album, e: React.MouseEvent) => {
    e.stopPropagation();
    const pin = (album.passwordHash || album.pinHash || '').trim();
    if (!pin) return;
    navigator.clipboard.writeText(pin);
    setCopiedPinId(album.id);
    setCopiedPinToast(pin);
    setTimeout(() => setCopiedPinId(null), 2000);
    setTimeout(() => setCopiedPinToast(null), 2500);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Album Pelanggan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Daftar seluruh album studio aktif yang tersimpan langsung di Google Drive Anda.
          </p>
        </div>

        {/* Action Buttons: Desktop + Mobile */}
        <div className="flex items-center gap-2 relative">
          {/* Desktop Button Group: + Album | Upload Foto | Upload Folder */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={onOpenCreateAlbum}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Album</span>
            </button>

            {onOpenUploadPhotos && (
              <button
                onClick={onOpenUploadPhotos}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs transition transform active:scale-95 cursor-pointer"
                title="Pilih dan upload file foto"
              >
                <Upload className="w-4 h-4 text-slate-600" />
                <span>Upload Foto</span>
              </button>
            )}

            {onOpenUploadFolder && (
              <button
                onClick={onOpenUploadFolder}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 shadow-2xs transition transform active:scale-95 cursor-pointer"
                title="Pilih satu folder langsung dari komputer untuk diunggah"
              >
                <FolderUp className="w-4 h-4 text-blue-600" />
                <span>Upload Folder</span>
              </button>
            )}
          </div>

          {/* Mobile Actions: Compact + Tambah dropdown & direct buttons */}
          <div className="flex sm:hidden items-center gap-1.5 w-full">
            <button
              onClick={onOpenCreateAlbum}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs text-white bg-blue-600 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Album</span>
            </button>

            {onOpenUploadFolder && (
              <button
                onClick={onOpenUploadFolder}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs text-blue-700 bg-blue-50 border border-blue-200 shadow-2xs cursor-pointer"
              >
                <FolderUp className="w-3.5 h-3.5 text-blue-600" />
                <span>Folder</span>
              </button>
            )}

            <div className="relative">
              <button
                onClick={() => setShowMobileActionMenu(!showMobileActionMenu)}
                className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 shadow-2xs cursor-pointer"
                aria-label="Menu Aksi Tambahan"
              >
                <ChevronDown className="w-4 h-4" />
              </button>

              {showMobileActionMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => {
                      setShowMobileActionMenu(false);
                      onOpenCreateAlbum();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  >
                    <Plus className="w-4 h-4 text-blue-600" />
                    <span>Buat Album Baru</span>
                  </button>

                  {onOpenUploadPhotos && (
                    <button
                      onClick={() => {
                        setShowMobileActionMenu(false);
                        onOpenUploadPhotos();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    >
                      <Upload className="w-4 h-4 text-slate-600" />
                      <span>Upload Foto</span>
                    </button>
                  )}

                  {onOpenUploadFolder && (
                    <button
                      onClick={() => {
                        setShowMobileActionMenu(false);
                        onOpenUploadFolder();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-blue-700 hover:bg-blue-50"
                    >
                      <FolderUp className="w-4 h-4 text-blue-600" />
                      <span>Upload Folder</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Search, Filters & View Switcher */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-2xs">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari berdasarkan nama klien, acara, atau ID galeri..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                filterType === 'all' ? 'bg-white text-blue-700 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({activeAlbums.length})
            </button>
            <button
              onClick={() => setFilterType('locked')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                filterType === 'locked' ? 'bg-white text-blue-700 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              PIN Locked
            </button>
            <button
              onClick={() => setFilterType('unlocked')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                filterType === 'unlocked' ? 'bg-white text-blue-700 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Publik
            </button>
          </div>

          {/* Grid / Table Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-slate-600">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-blue-600 shadow-2xs' : 'hover:text-slate-900'
              }`}
              title="Tampilan Grid Kartu"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-blue-600 shadow-2xs' : 'hover:text-slate-900'
              }`}
              title="Tampilan Tabel"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Album List Display */}
      {filteredAlbums.length === 0 ? (
        <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-12 text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
            <Images className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Tidak ada album yang sesuai</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? `Tidak ditemukan album dengan kata kunci "${searchQuery}". Coba kata kunci lain.`
              : 'Belum ada album pelanggan. Klik tombol di bawah untuk membuat album baru.'}
          </p>
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              Reset Pencarian
            </button>
          ) : (
            <button
              onClick={onOpenCreateAlbum}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 inline-block cursor-pointer shadow-xs"
            >
              + Buat Album Sekarang
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW: 4R PHOTO RATIO CARDS (PORTRAIT 4:6 & LANDSCAPE 6:4) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5.5 items-start">
          {filteredAlbums.map((album) => (
            <div
              key={album.id}
              onClick={() => onSelectAlbum(album)}
              className="bg-white border border-slate-200 hover:border-blue-400 rounded-2xl overflow-hidden transition-all duration-300 group cursor-pointer flex flex-col justify-between shadow-2xs hover:shadow-lg hover:-translate-y-0.5"
            >
              {/* 4R Format Album Cover (Auto Orientation & Contain) */}
              <AlbumCoverPreview4R
                album={album}
                onCopyPin={handleCopyPin}
                copiedPinId={copiedPinId}
              />

              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between bg-white min-w-0">
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition truncate">
                    {album.eventName}
                  </h4>
                  <p className="text-xs text-slate-600 font-medium flex items-center gap-1.5 mt-0.5 truncate">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{album.customerName}</span>
                  </p>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-1 font-medium truncate">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {album.eventDate ? new Date(album.eventDate).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      }) : 'Tanggal acara'}
                    </span>
                  </p>
                </div>

                {/* Action buttons footer with flex-wrap and 6px gap (gap-1.5) - Never clipped, never overflowing */}
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="pt-3 border-t border-slate-100 w-full max-w-full flex flex-wrap items-center gap-1.5"
                >
                  {/* 1. QR Galeri */}
                  <button
                    type="button"
                    onClick={() => onOpenQRCode(album)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-slate-800 border border-slate-200 text-xs font-semibold whitespace-nowrap transition active:scale-95 cursor-pointer shrink-0"
                    title="Lihat & Download QR Code Galeri"
                  >
                    <QrCode className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                    <span>QR Galeri</span>
                  </button>

                  {/* 2. Pengaturan */}
                  {onOpenSettings && (
                    <button
                      type="button"
                      onClick={() => onOpenSettings(album)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-semibold whitespace-nowrap transition active:scale-95 cursor-pointer shrink-0"
                      title="Pengaturan & Keamanan Album"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                      <span>Pengaturan</span>
                    </button>
                  )}

                  {/* 3. Salin Link */}
                  <button
                    type="button"
                    onClick={(e) => handleCopyLink(album, e)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-semibold whitespace-nowrap transition active:scale-95 cursor-pointer shrink-0"
                    title="Salin Tautan Galeri"
                  >
                    {copiedId === album.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="text-emerald-700">Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        <span>Salin Link</span>
                      </>
                    )}
                  </button>

                  {/* 4. Buka Galeri */}
                  <a
                    href={getPublicGalleryUrl(album.galleryId, studioProfile.customGalleryDomain)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-slate-800 border border-slate-200 text-xs font-semibold whitespace-nowrap transition active:scale-95 cursor-pointer shrink-0"
                    title="Buka Halaman Galeri Pelanggan"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    <span>Buka Galeri</span>
                  </a>

                  {/* 5. Hapus */}
                  <button
                    type="button"
                    onClick={(e) => openDeleteConfirmation(album, e)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold whitespace-nowrap transition active:scale-95 cursor-pointer shrink-0"
                    title="Pindahkan ke Keranjang Sampah"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-slate-700">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Nama Acara & Klien</th>
                  <th className="py-3.5 px-4">Gallery ID</th>
                  <th className="py-3.5 px-4">Tanggal Acara</th>
                  <th className="py-3.5 px-4">Jumlah Foto</th>
                  <th className="py-3.5 px-4">Akses PIN</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAlbums.map((album) => (
                  <tr
                    key={album.id}
                    onClick={() => onSelectAlbum(album)}
                    className="hover:bg-slate-50 cursor-pointer transition"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
                          {album.coverPhotoUrl ? (
                            <img
                              src={album.coverPhotoUrl}
                              alt=""
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <Camera className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 hover:text-blue-600 transition">
                            {album.eventName}
                          </p>
                          <p className="text-xs text-slate-500 font-medium">{album.customerName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                      {album.galleryId}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {album.eventDate ? new Date(album.eventDate).toLocaleDateString('id-ID') : '-'}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {album.photosCount} Foto
                    </td>
                    <td className="py-3.5 px-4">
                      {(album.isPasswordProtected || album.pinEnabled) && (album.passwordHash || album.pinHash) ? (
                        <button
                          type="button"
                          onClick={(e) => handleCopyPin(album, e)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition cursor-pointer"
                          title="Klik untuk salin PIN ke clipboard"
                        >
                          <Lock className="w-3 h-3 text-amber-700 shrink-0" />
                          <span>
                            {copiedPinId === album.id ? 'PIN Disalin!' : `PIN: ${album.passwordHash || album.pinHash}`}
                          </span>
                        </button>
                      ) : (
                        <span className="text-slate-500 text-xs flex items-center gap-1">
                          <Unlock className="w-3 h-3 text-emerald-600" /> Publik Bebas
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onOpenQRCode(album)}
                          className="p-1.5 rounded-lg bg-slate-100 text-slate-800 hover:bg-slate-200 transition cursor-pointer"
                          title="QR Code"
                        >
                          <QrCode className="w-4 h-4 text-slate-700" />
                        </button>
                        {onOpenSettings && (
                          <button
                            type="button"
                            onClick={() => onOpenSettings(album)}
                            className="p-1.5 rounded-lg bg-slate-100 text-slate-800 hover:bg-slate-200 transition cursor-pointer"
                            title="Pengaturan & Keamanan Album"
                          >
                            <Settings className="w-4 h-4 text-slate-700" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleCopyLink(album, e)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                          title="Salin Link"
                        >
                          {copiedId === album.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <a
                          href={getPublicGalleryUrl(album.galleryId, studioProfile.customGalleryDomain)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition cursor-pointer"
                          title="Buka Galeri"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                          type="button"
                          onClick={(e) => openDeleteConfirmation(album, e)}
                          className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                          title="Pindahkan ke Keranjang Sampah"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Dialog Konfirmasi Hapus Album */}
      {albumToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-album-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            e.stopPropagation();
            if (!isDeleting) setAlbumToDelete(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 relative space-y-4"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="delete-album-title" className="text-lg font-bold text-slate-900">
                  Hapus Album?
                </h3>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  Album ini akan dipindahkan ke <strong>Keranjang Sampah</strong>. Foto dan folder Google Drive tidak akan dihapus permanen.
                </p>
              </div>
            </div>

            {/* Preview Album Ringkas */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs text-slate-700 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-900 truncate">
                  {albumToDelete.eventName}
                </span>
                <span className="font-mono text-[11px] bg-slate-200/70 text-slate-700 px-1.5 py-0.5 rounded shrink-0">
                  {albumToDelete.galleryId}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500 text-[11px]">
                <span className="truncate">Klien: {albumToDelete.customerName}</span>
                <span className="shrink-0">{albumToDelete.photosCount} Foto</span>
              </div>
            </div>

            {/* Action Buttons: [ Batal ] [ Pindahkan ke Sampah ] */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setAlbumToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 transition cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                    <span>Memindahkan...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Pindahkan ke Sampah</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification when Feedback / PIN is active */}
      {deleteToast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200 border ${
            deleteToast.type === 'success'
              ? 'bg-slate-900/95 text-white border-slate-800'
              : 'bg-rose-900/95 text-white border-rose-800'
          }`}
        >
          {deleteToast.type === 'success' ? (
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </div>
          )}
          <span>{deleteToast.message}</span>
        </div>
      )}

      {copiedPinToast && (
        <div className="fixed bottom-6 left-6 z-50 bg-slate-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200 border border-slate-800">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5" />
          </div>
          <span>
            PIN <strong className="text-amber-300 font-mono tracking-wider font-bold">{copiedPinToast}</strong> berhasil disalin
          </span>
        </div>
      )}
    </div>
  );
};
