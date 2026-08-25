import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Upload,
  QrCode,
  Copy,
  ExternalLink,
  Download,
  Trash2,
  Image as ImageIcon,
  Heart,
  FileText,
  Shield,
  Calendar,
  Clock,
  HardDrive,
  CheckCircle,
  Share2,
  RefreshCw,
  Eye,
  Star,
} from 'lucide-react';
import { Album, PhotoItem, StudioProfile, ClientSelection } from '../types';
import { PhotoUploader } from '../components/upload/PhotoUploader';
import { Modal } from '../components/common/Modal';
import { listPhotosInFolder, deleteDrivePhoto } from '../services/googleDriveService';
import { getPublicGalleryUrl } from '../config/appConfig';
import { downloadSinglePhoto, downloadPhotosAsZip } from '../services/downloadService';
import { getClientSelection } from '../services/dbService';

interface AlbumDetailPageProps {
  album: Album;
  accessToken: string;
  studioProfile: StudioProfile | null;
  onBack: () => void;
  onOpenQR: (album: Album) => void;
  onUpdateAlbum: (updated: Album) => Promise<void>;
  onTrashAlbum: (albumId: string) => void;
}

export const AlbumDetailPage: React.FC<AlbumDetailPageProps> = ({
  album,
  accessToken,
  studioProfile,
  onBack,
  onOpenQR,
  onUpdateAlbum,
  onTrashAlbum,
}) => {
  const [activeTab, setActiveTab] = useState<'photos' | 'selections'>('photos');
  const [photos, setPhotos] = useState<PhotoItem[]>(album.photos || []);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState<boolean>(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [clientSelection, setClientSelection] = useState<ClientSelection | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);

  // Lightbox Preview
  const [previewPhoto, setPreviewPhoto] = useState<PhotoItem | null>(null);

  // Zip Progress State
  const [zipProgress, setZipProgress] = useState<{ active: boolean; percent: number; text: string }>({
    active: false,
    percent: 0,
    text: '',
  });

  // Fetch / Sync photos from Google Drive
  const loadFolderPhotos = async () => {
    if (!accessToken || !album.driveFolderId) return;
    setIsLoadingPhotos(true);
    try {
      const drivePhotos = await listPhotosInFolder(accessToken, album.driveFolderId);
      setPhotos(drivePhotos);

      // Update album in state & database
      const updatedAlbum: Album = {
        ...album,
        photos: drivePhotos,
        photoCount: drivePhotos.length,
        coverPhotoUrl: album.coverPhotoUrl || (drivePhotos[0]?.thumbnailUrl),
        updatedAt: new Date().toISOString(),
      };
      await onUpdateAlbum(updatedAlbum);
    } catch (err) {
      console.warn('[ALBUM_DETAIL] Failed to sync Drive photos:', err);
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  // Load client selections & notes
  const loadSelections = async () => {
    try {
      const sel = await getClientSelection(album.galleryId);
      setClientSelection(sel);
    } catch (err) {
      console.warn('[ALBUM_DETAIL] Selections load error:', err);
    }
  };

  useEffect(() => {
    loadFolderPhotos();
    loadSelections();
  }, [album.albumId]);

  const handlePhotosUploaded = async (newPhotos: PhotoItem[]) => {
    const combined = [...photos, ...newPhotos];
    // Deduplicate by driveFileId
    const unique = Array.from(new Map(combined.map((p) => [p.driveFileId, p])).values());
    setPhotos(unique);

    const updatedAlbum: Album = {
      ...album,
      photos: unique,
      photoCount: unique.length,
      coverPhotoUrl: album.coverPhotoUrl || unique[0]?.thumbnailUrl,
      updatedAt: new Date().toISOString(),
    };
    await onUpdateAlbum(updatedAlbum);
    setIsUploadModalOpen(false);
  };

  const handleDeletePhoto = async (photo: PhotoItem) => {
    if (!confirm(`Hapus foto "${photo.name}" dari Google Drive dan album?`)) return;

    try {
      await deleteDrivePhoto(accessToken, photo.driveFileId);
      const remaining = photos.filter((p) => p.driveFileId !== photo.driveFileId);
      setPhotos(remaining);

      const updatedAlbum: Album = {
        ...album,
        photos: remaining,
        photoCount: remaining.length,
        coverPhotoUrl: album.coverPhotoUrl === photo.thumbnailUrl ? (remaining[0]?.thumbnailUrl || '') : album.coverPhotoUrl,
        updatedAt: new Date().toISOString(),
      };
      await onUpdateAlbum(updatedAlbum);
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus foto.');
    }
  };

  const handleSetCoverPhoto = async (photo: PhotoItem) => {
    const updatedAlbum: Album = {
      ...album,
      coverPhotoUrl: photo.thumbnailUrl || photo.webViewLink,
      updatedAt: new Date().toISOString(),
    };
    await onUpdateAlbum(updatedAlbum);
    alert('Foto sampul album berhasil diperbarui!');
  };

  const handleDownloadAllZip = async () => {
    if (photos.length === 0) {
      alert('Tidak ada foto untuk diunduh.');
      return;
    }

    setZipProgress({ active: true, percent: 5, text: 'Menyiapkan unduhan semua foto...' });
    try {
      await downloadPhotosAsZip(
        photos,
        `${album.albumName.replace(/\s+/g, '_')}_Original.zip`,
        (percent, text) => {
          setZipProgress({ active: true, percent, text });
        }
      );
      setTimeout(() => setZipProgress({ active: false, percent: 0, text: '' }), 1500);
    } catch (err: any) {
      alert(err.message || 'Gagal mengunduh ZIP.');
      setZipProgress({ active: false, percent: 0, text: '' });
    }
  };

  const handleCopyPublicUrl = () => {
    const url = getPublicGalleryUrl(album.galleryId);
    navigator.clipboard.writeText(url);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const publicUrl = getPublicGalleryUrl(album.galleryId);
  const selectedPhotosList = photos.filter((p) => clientSelection?.selectedPhotoIds.includes(p.driveFileId));

  return (
    <div className="space-y-6 pb-16">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 px-3.5 py-2 border border-slate-200 rounded-xl transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Daftar Album
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenQR(album)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <QrCode className="w-4 h-4 text-blue-400" />
            <span>QR Code</span>
          </button>

          <button
            onClick={handleCopyPublicUrl}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              copyFeedback
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-sm'
            }`}
          >
            <Copy className="w-4 h-4" />
            <span>{copyFeedback ? 'Tersalin!' : 'Salin Tautan'}</span>
          </button>

          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">Buka Galeri Publik</span>
          </a>
        </div>
      </div>

      {/* Album Header Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{album.albumName}</h1>
            <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2.5 py-1 rounded-lg">
              ID: {album.galleryId}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
            <span>👤 Pelanggan: <strong className="text-slate-800">{album.clientName}</strong></span>
            {album.eventDate && <span>📅 Acara: <strong className="text-slate-800">{album.eventDate}</strong></span>}
            {album.isPinEnabled && album.pin && (
              <span className="flex items-center gap-1 text-amber-700 font-mono font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                <Shield className="w-3 h-3 text-amber-600" /> PIN: {album.pin}
              </span>
            )}
            <span className="flex items-center gap-1 text-blue-700 font-semibold">
              <HardDrive className="w-3.5 h-3.5" /> Folder Drive Terhubung
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 self-stretch md:self-auto">
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all"
          >
            <Upload className="w-4 h-4" />
            + Unggah Foto Asli
          </button>

          <button
            onClick={handleDownloadAllZip}
            disabled={photos.length === 0 || zipProgress.active}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 rounded-xl text-xs font-bold transition-all"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download Semua (ZIP)</span>
          </button>
        </div>
      </div>

      {/* ZIP Progress Bar Alert */}
      {zipProgress.active && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-blue-900">
            <span>{zipProgress.text}</span>
            <span>{zipProgress.percent}%</span>
          </div>
          <div className="w-full bg-blue-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-300 rounded-full"
              style={{ width: `${zipProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('photos')}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'photos'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          Semua Foto ({photos.length})
        </button>

        <button
          onClick={() => setActiveTab('selections')}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'selections'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Heart className="w-4 h-4 text-rose-500" />
          Pilihan & Catatan Pelanggan ({clientSelection?.selectedPhotoIds.length || 0})
        </button>
      </div>

      {/* Tab Content 1: Photos Grid */}
      {activeTab === 'photos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Foto disimpan langsung di folder Google Drive album dengan resolusi dan kualitas asli.
            </p>
            <button
              onClick={loadFolderPhotos}
              disabled={isLoadingPhotos}
              className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-blue-600"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPhotos ? 'animate-spin' : ''}`} />
              Segarkan Foto dari Drive
            </button>
          </div>

          {photos.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white border-2 border-dashed border-slate-200 rounded-3xl">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Upload className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-slate-800">Belum Ada Foto di Album Ini</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
                Unggah foto foto hasil pemotretan ke album ini. Format foto asli akan dipertahankan sepenuhnya.
              </p>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
              >
                + Unggah Foto Sekarang
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {photos.map((photo) => (
                <div
                  key={photo.driveFileId}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm group hover:shadow-md transition-all flex flex-col justify-between"
                >
                  {/* Image container */}
                  <div
                    onClick={() => setPreviewPhoto(photo)}
                    className="relative aspect-square bg-slate-100 overflow-hidden cursor-pointer"
                  >
                    <img
                      src={photo.thumbnailUrl || photo.webViewLink}
                      alt={photo.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewPhoto(photo);
                        }}
                        title="Lihat Foto Penuh"
                        className="p-2 bg-white/90 hover:bg-white text-slate-900 rounded-xl shadow-sm transition-transform active:scale-90"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadSinglePhoto(photo);
                        }}
                        title="Download Foto Asli"
                        className="p-2 bg-white/90 hover:bg-white text-slate-900 rounded-xl shadow-sm transition-transform active:scale-90"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Cover Photo Badge */}
                    {album.coverPhotoUrl === photo.thumbnailUrl && (
                      <span className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm flex items-center gap-1">
                        <Star className="w-3 h-3 fill-current" /> Sampul
                      </span>
                    )}
                  </div>

                  {/* Details & Actions Footer */}
                  <div className="p-3 bg-white space-y-1.5">
                    <p className="text-xs font-semibold text-slate-800 truncate" title={photo.name}>
                      {photo.name}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{(photo.size / 1024 / 1024).toFixed(1)} MB</span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleSetCoverPhoto(photo)}
                          title="Jadikan Sampul Album"
                          className="p-1 hover:text-amber-500 transition-colors"
                        >
                          <Star className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePhoto(photo)}
                          title="Hapus Foto"
                          className="p-1 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content 2: Client Selections */}
      {activeTab === 'selections' && (
        <div className="space-y-4">
          <div className="p-4 bg-rose-50/70 border border-rose-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider">
                Daftar Foto Favorit Pilihan Pelanggan
              </h4>
              <p className="text-xs text-rose-700 mt-0.5">
                Pelanggan telah memilih {clientSelection?.selectedPhotoIds.length || 0} foto dan memberikan catatan khusus.
              </p>
            </div>

            {selectedPhotosList.length > 0 && (
              <button
                onClick={() =>
                  downloadPhotosAsZip(
                    selectedPhotosList,
                    `${album.albumName.replace(/\s+/g, '_')}_Pilihan_${album.clientName.replace(/\s+/g, '_')}.zip`,
                    (pct, text) => setZipProgress({ active: true, percent: pct, text })
                  )
                }
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all shrink-0"
              >
                <Download className="w-4 h-4" />
                Download Foto Terpilih Saja (ZIP)
              </button>
            )}
          </div>

          {selectedPhotosList.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white border border-slate-200 rounded-3xl">
              <Heart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-800">Pelanggan Belum Memilih Foto</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Kirim tautan galeri kepada pelanggan agar mereka dapat menandai foto favorit dan menuliskan catatan cetak/retouch.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {selectedPhotosList.map((photo) => {
                const note = clientSelection?.notes?.[photo.driveFileId];

                return (
                  <div
                    key={photo.driveFileId}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between"
                  >
                    <div className="relative aspect-square bg-slate-100">
                      <img
                        src={photo.thumbnailUrl || photo.webViewLink}
                        alt={photo.name}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-full shadow-sm">
                        <Heart className="w-3.5 h-3.5 fill-current" />
                      </span>
                    </div>

                    <div className="p-3 space-y-2">
                      <p className="text-xs font-semibold text-slate-800 truncate">{photo.name}</p>

                      {note ? (
                        <div className="p-2 bg-amber-50 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 space-y-0.5">
                          <span className="font-bold flex items-center gap-1">
                            <FileText className="w-3 h-3 text-amber-600" /> Catatan Klien:
                          </span>
                          <p className="italic">"{note}"</p>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">Tanpa catatan tambahan</p>
                      )}

                      <button
                        onClick={() => downloadSinglePhoto(photo)}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-all"
                      >
                        <Download className="w-3.5 h-3.5" /> Unduh Foto Asli
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Upload Photos Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title={`Unggah Foto — ${album.albumName}`}
        subtitle="Simpan foto asli berkualitas tinggi ke folder Google Drive pelanggan"
        maxWidth="2xl"
      >
        <PhotoUploader
          accessToken={accessToken}
          driveFolderId={album.driveFolderId}
          onPhotosUploaded={handlePhotosUploaded}
          onClose={() => setIsUploadModalOpen(false)}
        />
      </Modal>

      {/* Fullscreen Lightbox Preview */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-between p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="w-full flex items-center justify-between text-white p-2">
            <span className="text-xs font-semibold truncate max-w-xs">{previewPhoto.name}</span>
            <button
              onClick={() => setPreviewPhoto(null)}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold"
            >
              Tutup (ESC)
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center p-2 max-w-5xl max-h-[80vh]">
            <img
              src={`https://lh3.googleusercontent.com/u/0/d/${previewPhoto.driveFileId}=w2400` || previewPhoto.webViewLink}
              alt={previewPhoto.name}
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="p-3 flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadSinglePhoto(previewPhoto);
              }}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Unduh Foto Asli ({(previewPhoto.size / 1024 / 1024).toFixed(2)} MB)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
