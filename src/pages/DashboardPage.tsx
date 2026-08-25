import React from 'react';
import {
  FolderKanban,
  CheckCircle,
  Clock,
  Image as ImageIcon,
  HardDrive,
  Plus,
  QrCode,
  Copy,
  ExternalLink,
  Upload,
  ArrowRight,
  Shield,
  Calendar,
} from 'lucide-react';
import { Album, StudioProfile } from '../types';
import { StorageQuotaInfo } from '../hooks/useStudioData';
import { getPublicGalleryUrl } from '../config/appConfig';

interface DashboardPageProps {
  albums: Album[];
  profile: StudioProfile | null;
  quota: StorageQuotaInfo | null;
  isDriveConnected: boolean;
  onOpenCreateAlbum: () => void;
  onOpenQR: (album: Album) => void;
  onOpenAlbumDetail: (album: Album) => void;
  onSelectTab: (tab: string) => void;
  onConnectDrive: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  albums,
  profile,
  quota,
  isDriveConnected,
  onOpenCreateAlbum,
  onOpenQR,
  onOpenAlbumDetail,
  onSelectTab,
  onConnectDrive,
}) => {
  const activeAlbums = albums.filter((a) => {
    const isPast = new Date(a.expirationDate).getTime() < Date.now();
    return a.status === 'active' && !isPast;
  });

  const expiredAlbums = albums.filter((a) => {
    const isPast = new Date(a.expirationDate).getTime() < Date.now();
    return a.status === 'expired' || isPast;
  });

  const totalPhotos = albums.reduce((acc, curr) => acc + (curr.photoCount || curr.photos?.length || 0), 0);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  const [copyFeedback, setCopyFeedback] = React.useState<string | null>(null);

  const handleCopyLink = (galleryId: string) => {
    const url = getPublicGalleryUrl(galleryId);
    navigator.clipboard.writeText(url);
    setCopyFeedback(galleryId);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full text-xs font-semibold">
            ✨ Studio Cloud Workspace
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            {profile?.studioName || 'GaleriFotoQR Cloud Studio'}
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Kelola album foto klien, simpan foto asli ke Google Drive tanpa kompresi, dan bagikan tautan galeri & QR Code instan tanpa login pelanggan.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 shrink-0">
          <button
            onClick={onOpenCreateAlbum}
            className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-2xl shadow-lg shadow-blue-600/30 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            + Buat Album Baru
          </button>
        </div>
      </div>

      {/* Connection Notice if disconnected */}
      {!isDriveConnected && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">Google Drive Belum Terhubung</h4>
              <p className="text-xs text-amber-700">
                Hubungkan Google Drive agar studio dapat membuat folder dan mengunggah foto asli secara otomatis.
              </p>
            </div>
          </div>
          <button
            onClick={onConnectDrive}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all shrink-0"
          >
            Hubungkan Google Drive Sekarang
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Album */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <FolderKanban className="w-5 h-5" />
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-slate-900">{albums.length}</span>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Total Album Pelanggan</p>
          </div>
        </div>

        {/* Album Aktif */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-slate-900">{activeAlbums.length}</span>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Album Aktif</p>
          </div>
        </div>

        {/* Total Foto */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-slate-900">{totalPhotos}</span>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Total Foto Tersimpan</p>
          </div>
        </div>

        {/* Drive Storage */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xl sm:text-2xl font-black text-slate-900">
              {quota ? formatBytes(quota.usage) : '0 GB'}
            </span>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Kapasitas Drive Terpakai {quota && quota.limit > 0 ? `(${formatBytes(quota.limit)})` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Action Bento Grid */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
          Aksi Cepat Studio
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={onOpenCreateAlbum}
            className="p-5 bg-white hover:bg-blue-50/40 border border-slate-200 hover:border-blue-300 rounded-2xl text-left transition-all group shadow-sm flex flex-col justify-between h-36"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                Buat Album Baru
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">Generate Gallery ID & folder Drive instan</p>
            </div>
          </button>

          <button
            onClick={() => onSelectTab('albums')}
            className="p-5 bg-white hover:bg-emerald-50/40 border border-slate-200 hover:border-emerald-300 rounded-2xl text-left transition-all group shadow-sm flex flex-col justify-between h-36"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                Kelola Album Pelanggan
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">Upload foto, pantau QR, edit status album</p>
            </div>
          </button>

          <button
            onClick={() => onSelectTab('branding')}
            className="p-5 bg-white hover:bg-purple-50/40 border border-slate-200 hover:border-purple-300 rounded-2xl text-left transition-all group shadow-sm flex flex-col justify-between h-36"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                Profil & Branding Studio
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">Kustomisasi logo, nomor WA, dan warna brand</p>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Albums Section */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Album Pelanggan Terbaru</h3>
            <p className="text-xs text-slate-500">Daftar album yang siap dibagikan kepada pelanggan</p>
          </div>

          {albums.length > 0 && (
            <button
              onClick={() => onSelectTab('albums')}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
            >
              Lihat Semua Album <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {albums.length === 0 ? (
          <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-2xl">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <FolderKanban className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">Belum Ada Album Pelanggan</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              Mulai buat album pertama untuk klien Anda. Sistem akan membuatkan folder Google Drive dan QR Code secara otomatis.
            </p>
            <button
              onClick={onOpenCreateAlbum}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              + Buat Album Pertama
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {albums.slice(0, 5).map((album) => {
              const isPast = new Date(album.expirationDate).getTime() < Date.now();
              const isExpired = album.status === 'expired' || isPast;

              return (
                <div
                  key={album.albumId}
                  className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/60 rounded-xl px-2 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    {/* Thumbnail */}
                    <div
                      onClick={() => onOpenAlbumDetail(album)}
                      className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden cursor-pointer shrink-0 flex items-center justify-center relative group"
                    >
                      {album.coverPhotoUrl || album.photos?.[0]?.thumbnailUrl ? (
                        <img
                          src={album.coverPhotoUrl || album.photos?.[0]?.thumbnailUrl}
                          alt={album.albumName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-slate-400" />
                      )}
                    </div>

                    {/* Meta */}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4
                          onClick={() => onOpenAlbumDetail(album)}
                          className="text-sm font-bold text-slate-900 hover:text-blue-600 cursor-pointer transition-colors"
                        >
                          {album.albumName}
                        </h4>
                        <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          {album.galleryId}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                        <span>👤 {album.clientName}</span>
                        {album.eventDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {album.eventDate}
                          </span>
                        )}
                        <span>📸 {album.photoCount || album.photos?.length || 0} Foto</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => onOpenQR(album)}
                      title="Lihat & Download QR Code"
                      className="p-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                    >
                      <QrCode className="w-4 h-4" />
                      <span className="hidden md:inline">QR Code</span>
                    </button>

                    <button
                      onClick={() => handleCopyLink(album.galleryId)}
                      title="Salin Tautan Galeri"
                      className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        copyFeedback === album.galleryId
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <Copy className="w-4 h-4" />
                      <span className="hidden md:inline">
                        {copyFeedback === album.galleryId ? 'Tersalin' : 'Salin'}
                      </span>
                    </button>

                    <button
                      onClick={() => onOpenAlbumDetail(album)}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                    >
                      Buka Album
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
