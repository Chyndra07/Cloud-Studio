import React, { useState, useEffect } from 'react';
import {
  Shield,
  Clock,
  Heart,
  Download,
  Share2,
  Phone,
  Image as ImageIcon,
  Check,
  Eye,
  X,
  FileText,
  Camera,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Zap,
  Folder,
  ArrowLeft,
  Search,
} from 'lucide-react';
import { PublicGalleryData, PhotoItem, ClientSelection, AlbumFolder } from '../types';
import { getPublicGalleryData, getClientSelection, saveClientSelection } from '../services/dbService';
import { downloadSinglePhoto, downloadPhotosAsZip } from '../services/downloadService';
import { ModernStudioBanner } from '../components/banner/ModernStudioBanner';
import { getGalleryPhotoPreviewUrl, getGalleryPhotoFallbackUrl } from '../services/photoService';
import { applyTypography } from '../services/typographyService';
import { FolderCard } from '../components/albums/FolderCard';

interface PublicGalleryPageProps {
  galleryId: string;
  onNavigateHome?: () => void;
}

export const PublicGalleryPage: React.FC<PublicGalleryPageProps> = ({ galleryId, onNavigateHome }) => {
  const [gallery, setGallery] = useState<PublicGalleryData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // PIN Unlock State
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Client Selections State
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [photoNotes, setPhotoNotes] = useState<Record<string, string>>({});
  const [editingNotePhotoId, setEditingNotePhotoId] = useState<string | null>(null);
  const [activeNoteText, setActiveNoteText] = useState<string>('');

  // Apply Studio Typography for Public Gallery View
  useEffect(() => {
    if (gallery?.studio?.typography) {
      applyTypography(gallery.studio.typography);
    } else if (gallery?.studio?.fontFamily || gallery?.studio?.fontSize) {
      applyTypography({
        fontFamily: gallery.studio.fontFamily || 'Inter',
        fontSize: gallery.studio.fontSize || 'm',
      });
    } else {
      applyTypography({ fontFamily: 'Inter', fontSize: 'm' });
    }
  }, [gallery]);

  // Lightbox Preview
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  // Preview Quality State ('light' = Preview Ringan (default) | 'hd' = Preview HD)
  const [previewQuality, setPreviewQuality] = useState<'light' | 'hd'>(() => {
    try {
      const saved = localStorage.getItem('gfq_gallery_preview_mode');
      return saved === 'hd' ? 'hd' : 'light';
    } catch {
      return 'light';
    }
  });

  const handleQualityChange = (mode: 'light' | 'hd') => {
    setPreviewQuality(mode);
    try {
      localStorage.setItem('gfq_gallery_preview_mode', mode);
    } catch (e) {
      console.warn('Failed to save preview quality preference', e);
    }
  };

  // ZIP Progress
  const [zipProgress, setZipProgress] = useState<{ active: boolean; percent: number; text: string }>({
    active: false,
    percent: 0,
    text: '',
  });

  // Tab Navigation State ('photos' | 'folders' | 'selections')
  const [activeTab, setActiveTab] = useState<'photos' | 'folders' | 'selections'>('photos');

  // Active Subfolder ID inside 'folders' tab
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // Search filter query
  const [searchQuery, setSearchQuery] = useState<string>('');

  const cleanGalleryId = (galleryId || '').trim().toUpperCase();

  // Load public gallery metadata
  const loadGallery = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getPublicGalleryData(cleanGalleryId);
      if (!data) {
        throw new Error(`Galeri dengan ID "${cleanGalleryId}" tidak ditemukan atau belum dipublikasikan.`);
      }

      setGallery(data);

      // Check if PIN required
      const storedPinAuth = sessionStorage.getItem(`gfq_pin_auth_${cleanGalleryId}`);
      if (!data.isPinRequired || storedPinAuth === 'granted' || !data.pin) {
        setIsUnlocked(true);
      }

      // Load client favorites
      const selection = await getClientSelection(cleanGalleryId);
      if (selection) {
        setSelectedPhotoIds(selection.selectedPhotoIds || []);
        setPhotoNotes(selection.notes || {});
      }
    } catch (err: any) {
      console.error('[PUBLIC_GALLERY] Load error:', err);
      setError(err?.message || 'Gagal memuat galeri foto.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGallery();
  }, [cleanGalleryId]);

  // Handle PIN verification
  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gallery) return;

    if (enteredPin.trim() === gallery.pin.trim()) {
      setIsUnlocked(true);
      sessionStorage.setItem(`gfq_pin_auth_${cleanGalleryId}`, 'granted');
      setPinError(null);
    } else {
      setPinError('Kode PIN salah. Silakan periksa kembali PIN Anda.');
    }
  };

  // Toggle favorite photo
  const handleToggleFavorite = async (photoId: string) => {
    let newSelected: string[];
    if (selectedPhotoIds.includes(photoId)) {
      newSelected = selectedPhotoIds.filter((id) => id !== photoId);
    } else {
      newSelected = [...selectedPhotoIds, photoId];
    }
    setSelectedPhotoIds(newSelected);

    const selection: ClientSelection = {
      galleryId: cleanGalleryId,
      selectedPhotoIds: newSelected,
      notes: photoNotes,
      updatedAt: new Date().toISOString(),
    };
    await saveClientSelection(selection);
  };

  // Save photo custom note
  const handleSavePhotoNote = async (photoId: string) => {
    const updatedNotes = {
      ...photoNotes,
      [photoId]: activeNoteText.trim(),
    };
    if (!activeNoteText.trim()) {
      delete updatedNotes[photoId];
    }
    setPhotoNotes(updatedNotes);

    // Auto-select if note is added
    let updatedSelected = selectedPhotoIds;
    if (activeNoteText.trim() && !selectedPhotoIds.includes(photoId)) {
      updatedSelected = [...selectedPhotoIds, photoId];
      setSelectedPhotoIds(updatedSelected);
    }

    const selection: ClientSelection = {
      galleryId: cleanGalleryId,
      selectedPhotoIds: updatedSelected,
      notes: updatedNotes,
      updatedAt: new Date().toISOString(),
    };
    await saveClientSelection(selection);
    setEditingNotePhotoId(null);
    setActiveNoteText('');
  };

  // Download all as ZIP
  const handleDownloadAll = async () => {
    if (!gallery || !gallery.photos || gallery.photos.length === 0) return;
    setZipProgress({ active: true, percent: 5, text: 'Menyiapkan unduhan semua foto...' });
    try {
      await downloadPhotosAsZip(
        gallery.photos,
        `${gallery.albumName.replace(/\s+/g, '_')}_Foto_Asli.zip`,
        (percent, text) => setZipProgress({ active: true, percent, text })
      );
      setTimeout(() => setZipProgress({ active: false, percent: 0, text: '' }), 1500);
    } catch (err: any) {
      alert(err.message || 'Gagal mengunduh ZIP.');
      setZipProgress({ active: false, percent: 0, text: '' });
    }
  };

  // Download selected as ZIP
  const handleDownloadSelected = async () => {
    if (!gallery || selectedPhotoIds.length === 0) return;
    const selectedPhotos = gallery.photos.filter((p) => selectedPhotoIds.includes(p.driveFileId));
    if (selectedPhotos.length === 0) return;

    setZipProgress({ active: true, percent: 5, text: 'Menyiapkan unduhan foto terpilih...' });
    try {
      await downloadPhotosAsZip(
        selectedPhotos,
        `${gallery.albumName.replace(/\s+/g, '_')}_Pilihan_${gallery.clientName.replace(/\s+/g, '_')}.zip`,
        (percent, text) => setZipProgress({ active: true, percent, text })
      );
      setTimeout(() => setZipProgress({ active: false, percent: 0, text: '' }), 1500);
    } catch (err: any) {
      alert(err.message || 'Gagal mengunduh ZIP.');
      setZipProgress({ active: false, percent: 0, text: '' });
    }
  };

  // Send selections to Studio via WhatsApp
  const handleSendSelectionToWhatsApp = () => {
    if (!gallery) return;
    const selectedPhotos = gallery.photos.filter((p) => selectedPhotoIds.includes(p.driveFileId));
    
    let text = `Halo *${gallery.studio.studioName}*! 👋\n\nSaya *${gallery.clientName}* telah memilih *${selectedPhotos.length} foto favorit* dari album *"${gallery.albumName}"* (Gallery ID: ${gallery.galleryId}):\n\n`;

    selectedPhotos.forEach((photo, idx) => {
      const note = photoNotes[photo.driveFileId];
      text += `${idx + 1}. 📸 *${photo.name}*${note ? `\n   📝 Catatan: "${note}"` : ''}\n`;
    });

    text += `\nMohon untuk diproses sesuai pilihan di atas. Terima kasih banyak! ✨`;

    const waNum = gallery.studio.whatsappNumber || '';
    const cleanWaNum = waNum.replace(/\D/g, '');
    const waUrl = cleanWaNum
      ? `https://api.whatsapp.com/send?phone=${cleanWaNum}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

    window.open(waUrl, '_blank');
  };

  // Calculate remaining days
  const getRemainingDays = () => {
    if (!gallery?.expirationDate) return 0;
    const diff = new Date(gallery.expirationDate).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Lightbox navigation
  const currentPhoto = gallery && previewIndex !== null ? gallery.photos[previewIndex] : null;

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!gallery || previewIndex === null) return;
    setPreviewIndex((previewIndex + 1) % gallery.photos.length);
  };

  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!gallery || previewIndex === null) return;
    setPreviewIndex((previewIndex - 1 + gallery.photos.length) % gallery.photos.length);
  };

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <h3 className="text-base font-bold text-slate-200">Memuat Galeri Foto...</h3>
        <p className="text-xs text-slate-400 font-mono">ID: {galleryId}</p>
      </div>
    );
  }

  // 2. Error / Not Found State
  if (error || !gallery) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-xl space-y-4">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Galeri Tidak Ditemukan</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {error || `Galeri dengan ID ${galleryId} tidak tersedia. Silakan hubungi pihak studio foto Anda.`}
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={loadGallery}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-4 h-4" /> Coba Muat Ulang
            </button>
            {onNavigateHome && (
              <button
                onClick={onNavigateHome}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Kembali ke Beranda
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 3. Expired State
  if (gallery.isExpired || gallery.status === 'expired') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-xl space-y-4">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
            <Clock className="w-7 h-7" />
          </div>
          <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
            ID: {gallery.galleryId}
          </span>
          <h2 className="text-xl font-bold text-slate-900">Masa Berlaku Galeri Telah Berakhir</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Masa aktif galeri foto <strong>"{gallery.albumName}"</strong> telah kedaluwarsa pada {new Date(gallery.expirationDate).toLocaleDateString('id-ID')}.
          </p>
          {gallery.studio.whatsappNumber && (
            <div className="pt-2">
              <a
                href={`https://api.whatsapp.com/send?phone=${gallery.studio.whatsappNumber.replace(/\D/g, '')}&text=Halo%20${encodeURIComponent(gallery.studio.studioName)},%20saya%20ingin%20memperpanjang%20akses%20galeri%20${gallery.galleryId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all"
              >
                <Phone className="w-4 h-4" /> Hubungi Studio via WhatsApp
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. PIN Locked Screen
  if (!isUnlocked && gallery.isPinRequired) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 text-center shadow-2xl space-y-6">
          {/* Studio Brand Logo or Camera Fallback */}
          <div className="flex justify-center">
            {gallery.studio?.logoUrl ? (
              <div className="w-20 h-20 rounded-2xl bg-white p-2.5 flex items-center justify-center shadow-xl border border-slate-200/80 overflow-hidden">
                <img
                  src={gallery.studio.logoUrl}
                  alt={gallery.studio.studioName || 'Logo Studio'}
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    // Fallback to camera icon if image fails to load
                    const target = e.currentTarget;
                    target.style.display = 'none';
                    if (target.parentElement) {
                      target.parentElement.innerHTML = `<div class="w-full h-full rounded-xl flex items-center justify-center text-white" style="background-color: ${gallery.studio?.brandColor || '#2563eb'}"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg></div>`;
                    }
                  }}
                />
              </div>
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg text-white"
                style={{ backgroundColor: gallery.studio?.brandColor || '#2563eb' }}
              >
                <Camera className="w-8 h-8 text-white" />
              </div>
            )}
          </div>

          <div>
            <h2 className="text-xl font-black text-white">{gallery.studio.studioName}</h2>
            <p className="text-xs text-slate-400 mt-1">Galeri Foto Digital Resmi</p>
            <div className="mt-3 p-3 bg-slate-800/80 rounded-2xl border border-slate-700/60">
              <p className="text-sm font-bold text-blue-400">{gallery.albumName}</p>
              <p className="text-xs text-slate-400 mt-0.5">Klien: {gallery.clientName}</p>
            </div>
          </div>

          <form onSubmit={handleVerifyPin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Masukkan PIN Galeri (4 Digit)
              </label>
              <input
                type="password"
                maxLength={8}
                autoFocus
                placeholder="••••"
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-2xl text-center text-2xl font-mono tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {pinError && (
              <p className="text-xs text-rose-400 font-semibold animate-fade-in">{pinError}</p>
            )}

            <button
              type="submit"
              className="w-full py-3 text-white rounded-2xl text-xs font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
              style={{ backgroundColor: gallery.studio.brandColor || '#2563eb' }}
            >
              <Shield className="w-4 h-4" /> Buka Galeri Foto
            </button>
          </form>

          <p className="text-[11px] text-slate-500">
            PIN diberikan oleh fotografer / studio saat sesi pemotretan Anda.
          </p>
        </div>
      </div>
    );
  }

  // 5. UNLOCKED CLIENT PUBLIC GALLERY
  const brandColor = gallery.studio.brandColor || '#2563eb';
  const daysRemaining = getRemainingDays();

  // Collections & Folder Structuring
  const allPhotos = gallery.photos || [];
  const allFolders = gallery.folders || [];
  const selectedPhotosList = allPhotos.filter((p) => selectedPhotoIds.includes(p.driveFileId));

  // Current folder level computation for "folders" tab
  const currentFolderObj = currentFolderId ? allFolders.find((f) => f.id === currentFolderId) : null;
  const currentLevelFolders = allFolders.filter((f) =>
    currentFolderId ? f.parentId === currentFolderId : !f.parentId
  );
  const currentLevelPhotos = allPhotos.filter((p) =>
    currentFolderId ? p.folderId === currentFolderId : !p.folderId
  );

  // Photo Search Filters
  const filteredAllPhotos = allPhotos.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );
  const filteredCurrentLevelPhotos = currentLevelPhotos.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  // Shared Photo Card Renderer
  const renderPhotoCard = (photo: PhotoItem, index: number) => {
    const isSelected = selectedPhotoIds.includes(photo.driveFileId);
    const note = photoNotes[photo.driveFileId];

    return (
      <div
        key={photo.driveFileId}
        className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition-all flex flex-col justify-between group ${
          isSelected
            ? 'border-rose-500 ring-2 ring-rose-500/20 shadow-md'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        {/* Thumbnail Image (Portrait 9:16) */}
        <div
          onClick={() => {
            const globalIndex = gallery.photos.findIndex((p) => p.driveFileId === photo.driveFileId);
            setPreviewIndex(globalIndex >= 0 ? globalIndex : index);
          }}
          className="relative w-full aspect-[9/16] bg-slate-950 overflow-hidden flex items-center justify-center cursor-pointer rounded-t-2xl shrink-0"
          style={{ aspectRatio: '9 / 16', width: '100%' }}
        >
          {/* Ambient subtle blur backdrop */}
          <img
            src={getGalleryPhotoPreviewUrl(photo, previewQuality)}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover opacity-25 filter blur-lg scale-110 pointer-events-none"
          />
          {/* 100% Uncropped Photo with object-contain */}
          <img
            src={getGalleryPhotoPreviewUrl(photo, previewQuality)}
            alt={photo.name}
            loading="lazy"
            onError={(e) => {
              const fallback = getGalleryPhotoFallbackUrl(photo, previewQuality);
              if (fallback && e.currentTarget.src !== fallback) {
                e.currentTarget.src = fallback;
              }
            }}
            className="relative z-10 max-w-full max-h-full w-full h-full transition-transform duration-300 group-hover:scale-[1.02]"
            style={{ objectFit: 'contain', objectPosition: 'center center' }}
          />

          {/* Favorite Heart Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleFavorite(photo.driveFileId);
            }}
            className={`absolute top-2 right-2 p-2 rounded-full shadow-md transition-all active:scale-90 ${
              isSelected
                ? 'bg-rose-500 text-white'
                : 'bg-black/40 hover:bg-black/60 text-white/90'
            }`}
            title={isSelected ? 'Batalkan Pilihan' : 'Pilih Foto Favorit'}
          >
            <Heart className={`w-4 h-4 ${isSelected ? 'fill-current' : ''}`} />
          </button>

          {/* Quick Download Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              downloadSinglePhoto(photo);
            }}
            className="absolute bottom-2 right-2 p-1.5 bg-black/40 hover:bg-black/70 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
            title="Unduh Foto Ini"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Bottom Details & Note */}
        <div className="p-3 space-y-1.5 bg-white">
          <p className="text-[11px] font-semibold text-slate-800 truncate" title={photo.name}>
            {photo.name}
          </p>

          {note ? (
            <div
              onClick={() => {
                setEditingNotePhotoId(photo.driveFileId);
                setActiveNoteText(note);
              }}
              className="p-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-900 cursor-pointer hover:bg-amber-100"
            >
              <p className="truncate">📝 "{note}"</p>
            </div>
          ) : (
            <button
              onClick={() => {
                setEditingNotePhotoId(photo.driveFileId);
                setActiveNoteText('');
              }}
              className="text-[10px] font-medium text-slate-400 hover:text-blue-600 flex items-center gap-1"
            >
              <FileText className="w-3 h-3" /> + Tambah Catatan
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">
      {/* Top Studio Brand Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0 overflow-hidden shadow-xs border border-slate-200/60 bg-white"
          >
            {gallery.studio.logoUrl ? (
              <img src={gallery.studio.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white" style={{ backgroundColor: brandColor }}>
                <Camera className="w-4 h-4" />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[160px] sm:max-w-xs">
              {gallery.studio.studioName}
            </h1>
            <span className="text-[10px] text-slate-500 font-mono">ID: {gallery.galleryId}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {gallery.studio.whatsappNumber && (
            <a
              href={`https://api.whatsapp.com/send?phone=${gallery.studio.whatsappNumber.replace(/\D/g, '')}&text=Halo%20${encodeURIComponent(gallery.studio.studioName)},%20saya%20${encodeURIComponent(gallery.clientName)}%20mengenai%20galeri%20${gallery.galleryId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold transition-all"
            >
              <Phone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Hubungi Studio</span>
            </a>
          )}

          <button
            onClick={handleDownloadAll}
            disabled={zipProgress.active}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Download Semua (ZIP)</span>
            <span className="sm:hidden">ZIP</span>
          </button>
        </div>
      </header>

      {/* Main Hero Album Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
        <ModernStudioBanner
          albumName={gallery.albumName}
          clientName={gallery.clientName}
          eventDate={gallery.eventDate}
          photoCount={gallery.photos.length}
          daysRemaining={daysRemaining}
          customBannerUrl={gallery.bannerUrl || gallery.studio?.bannerUrl}
          studioName={gallery.studio?.studioName}
          brandColor={brandColor}
        />

        {/* ZIP Progress Alert */}
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

        {/* Segmented Navigation Tabs */}
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
            Semua Foto ({allPhotos.length})
          </button>

          <button
            onClick={() => setActiveTab('folders')}
            className={`flex items-center gap-2 pb-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'folders'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Folder className="w-4 h-4 text-amber-500" />
            Struktur Folder ({allFolders.length})
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
            Pilihan & Catatan Pelanggan ({selectedPhotoIds.length})
          </button>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: SEMUA FOTO */}
        {/* ======================================================== */}
        {activeTab === 'photos' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    Koleksi Foto ({allPhotos.length})
                  </h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">
                    {selectedPhotoIds.length} foto terpilih
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {previewQuality === 'light'
                    ? '⚡ Preview Ringan aktif: Hemat kuota internet & pemuatan foto lebih cepat'
                    : '✨ Preview HD aktif: Tampilan resolusi tinggi & ketajaman foto maksimal'}
                </p>
              </div>

              {/* Quality Segmented Control & Search Input */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari foto..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-xs"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/60 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => handleQualityChange('light')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      previewQuality === 'light'
                        ? 'bg-white text-blue-600 shadow-xs ring-1 ring-slate-900/5 font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                    }`}
                  >
                    <Zap className={`w-3.5 h-3.5 ${previewQuality === 'light' ? 'fill-blue-600 text-blue-600' : 'text-slate-500'}`} />
                    <span>Preview Ringan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQualityChange('hd')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      previewQuality === 'hd'
                        ? 'bg-white text-indigo-600 shadow-xs ring-1 ring-slate-900/5 font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                    }`}
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${previewQuality === 'hd' ? 'text-indigo-600' : 'text-slate-500'}`} />
                    <span>Preview HD</span>
                  </button>
                </div>
              </div>
            </div>

            {allPhotos.length === 0 ? (
              <div className="text-center py-20 bg-white border border-slate-200 rounded-3xl">
                <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-800">Foto Sedang Disiapkan</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Studio sedang mengunggah foto ke Google Drive. Silakan segarkan halaman beberapa saat lagi.
                </p>
              </div>
            ) : filteredAllPhotos.length === 0 ? (
              <div className="text-center py-16 px-4 bg-white border border-slate-200 rounded-3xl">
                <Search className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-800">Tidak Ada Foto yang Cocok</h4>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  Tidak ditemukan foto dengan nama "{searchQuery}".
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all"
                >
                  Hapus Pencarian
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-5 items-start">
                {filteredAllPhotos.map((photo, index) => renderPhotoCard(photo, index))}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: STRUKTUR FOLDER */}
        {/* ======================================================== */}
        {activeTab === 'folders' && (
          <div className="space-y-6">
            {/* Breadcrumb Navigation Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {currentFolderId !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      const parent = allFolders.find((f) => f.id === currentFolderObj?.parentId);
                      setCurrentFolderId(parent ? parent.id : null);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition-all border border-slate-200"
                    title="Kembali ke folder sebelumnya"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Kembali</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setCurrentFolderId(null)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all ${
                    currentFolderId === null
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Folder className="w-3.5 h-3.5 text-blue-600" />
                  <span>{gallery.albumName} (Root)</span>
                </button>

                {currentFolderObj && (
                  <>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                    <span className="px-2.5 py-1 bg-amber-50 text-amber-800 rounded-lg font-bold border border-amber-200/60 flex items-center gap-1.5">
                      <Folder className="w-3.5 h-3.5 text-amber-600" />
                      <span>{currentFolderObj.name}</span>
                    </span>
                  </>
                )}
              </div>

              {/* Quality Selector */}
              <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/60 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => handleQualityChange('light')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    previewQuality === 'light'
                      ? 'bg-white text-blue-600 shadow-xs ring-1 ring-slate-900/5 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Zap className={`w-3.5 h-3.5 ${previewQuality === 'light' ? 'fill-blue-600 text-blue-600' : 'text-slate-500'}`} />
                  <span>Preview Ringan</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQualityChange('hd')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    previewQuality === 'hd'
                      ? 'bg-white text-indigo-600 shadow-xs ring-1 ring-slate-900/5 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Sparkles className={`w-3.5 h-3.5 ${previewQuality === 'hd' ? 'text-indigo-600' : 'text-slate-500'}`} />
                  <span>Preview HD</span>
                </button>
              </div>
            </div>

            {/* Subfolders Grid */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Folder className="w-4 h-4 text-amber-500" />
                <span>Daftar Subfolder ({currentLevelFolders.length})</span>
              </h4>

              {allFolders.length === 0 ? (
                <div className="p-8 text-center bg-white border border-slate-200/80 rounded-2xl text-xs text-slate-500">
                  <Folder className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                  <p className="font-semibold text-slate-700">Belum Ada Struktur Folder</p>
                  <p className="text-slate-400 mt-0.5">Seluruh foto saat ini tersimpan langsung di direktori utama album.</p>
                </div>
              ) : currentLevelFolders.length === 0 ? (
                <div className="p-6 text-center bg-slate-50 border border-slate-200/80 rounded-2xl text-xs text-slate-500">
                  <Folder className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                  <p>Belum ada subfolder di level ini.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {currentLevelFolders.map((folder) => (
                    <FolderCard
                      key={folder.id}
                      folder={folder}
                      readOnly={true}
                      onOpen={(f) => setCurrentFolderId(f.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Photos Inside Current Folder Level */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-blue-500" />
                  <span>
                    Foto di {currentFolderObj ? `Folder "${currentFolderObj.name}"` : 'Direktori Utama'} (
                    {currentLevelPhotos.length})
                  </span>
                </h4>
              </div>

              {currentLevelPhotos.length === 0 ? (
                <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl text-xs text-slate-500">
                  <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                  <p>Tidak ada foto langsung di dalam folder ini.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-5 items-start">
                  {currentLevelPhotos.map((photo, index) => renderPhotoCard(photo, index))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: PILIHAN & CATATAN PELANGGAN */}
        {/* ======================================================== */}
        {activeTab === 'selections' && (
          <div className="space-y-4">
            <div className="bg-rose-50 border border-rose-200 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider">
                  Daftar Foto Favorit Pilihan Anda
                </h4>
                <p className="text-xs text-rose-700 mt-0.5">
                  Anda telah memilih {selectedPhotosList.length} foto. Anda dapat mengunduh hanya foto terpilih atau mengirimkannya langsung ke studio melalui WhatsApp.
                </p>
              </div>

              {selectedPhotosList.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleDownloadSelected}
                    disabled={zipProgress.active}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    Download Foto Terpilih (ZIP)
                  </button>

                  <button
                    onClick={handleSendSelectionToWhatsApp}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all shrink-0"
                  >
                    <Share2 className="w-4 h-4" />
                    Kirim ke WA Studio
                  </button>
                </div>
              )}
            </div>

            {selectedPhotosList.length === 0 ? (
              <div className="text-center py-16 px-4 bg-white border border-slate-200 rounded-3xl">
                <Heart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-800">Belum Ada Foto Pilihan Favorit</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Klik ikon hati pada foto yang Anda sukai untuk menyimpannya di sini dan menambahkan catatan cetak atau editing khusus.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-5 items-start">
                {selectedPhotosList.map((photo, index) => renderPhotoCard(photo, index))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Bottom Selection Bar */}
      {selectedPhotoIds.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-2xl mx-auto z-40">
          <div className="bg-slate-900/95 backdrop-blur-xl text-white border border-slate-800 p-4 rounded-3xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-rose-500 text-white rounded-2xl flex items-center justify-center shrink-0">
                <Heart className="w-4 h-4 fill-current" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">
                  {selectedPhotoIds.length} Foto Dipilih
                </h4>
                <p className="text-[10px] text-slate-400">Pilihan tersimpan otomatis</p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleDownloadSelected}
                className="flex-1 sm:flex-initial px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ZIP Pilihan</span>
              </button>

              <button
                onClick={handleSendSelectionToWhatsApp}
                className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Kirim ke WA Studio</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note Editing Modal */}
      {editingNotePhotoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white max-w-sm w-full rounded-2xl p-6 shadow-2xl space-y-4">
            <h4 className="text-sm font-bold text-slate-900">Catatan Khusus untuk Foto</h4>
            <textarea
              rows={3}
              value={activeNoteText}
              onChange={(e) => setActiveNoteText(e.target.value)}
              placeholder="Contoh: Edit jerawat, Cetak 4R 2 lembar, Lebihkan terang..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingNotePhotoId(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={() => handleSavePhotoNote(editingNotePhotoId)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm"
              >
                Simpan Catatan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Lightbox */}
      {currentPhoto && previewIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between select-none"
          onClick={() => setPreviewIndex(null)}
        >
          {/* Lightbox Header */}
          <div className="p-4 flex items-center justify-between text-white bg-black/40">
            <div>
              <p className="text-xs font-bold truncate max-w-xs">{currentPhoto.name}</p>
              <p className="text-[10px] text-slate-400 font-mono">
                Foto {previewIndex + 1} dari {gallery.photos.length}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleFavorite(currentPhoto.driveFileId);
                }}
                className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  selectedPhotoIds.includes(currentPhoto.driveFileId)
                    ? 'bg-rose-600 text-white'
                    : 'bg-white/20 hover:bg-white/30 text-white'
                }`}
              >
                <Heart
                  className={`w-4 h-4 ${
                    selectedPhotoIds.includes(currentPhoto.driveFileId) ? 'fill-current' : ''
                  }`}
                />
                <span className="hidden sm:inline">
                  {selectedPhotoIds.includes(currentPhoto.driveFileId) ? 'Terpilih' : 'Pilih Foto'}
                </span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  downloadSinglePhoto(currentPhoto);
                }}
                className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Unduh Foto Asli</span>
              </button>

              <button
                onClick={() => setPreviewIndex(null)}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Lightbox Main Image & Navigation Arrows */}
          <div className="relative flex-1 flex items-center justify-center p-4">
            <button
              onClick={handlePrevPhoto}
              className="absolute left-4 p-3 bg-black/50 hover:bg-black/80 text-white rounded-full transition-all"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <img
              src={`https://lh3.googleusercontent.com/u/0/d/${currentPhoto.driveFileId}=w2400` || currentPhoto.webViewLink}
              alt={currentPhoto.name}
              className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            <button
              onClick={handleNextPhoto}
              className="absolute right-4 p-3 bg-black/50 hover:bg-black/80 text-white rounded-full transition-all"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Lightbox Footer */}
          <div className="p-4 text-center text-xs text-slate-400 bg-black/40">
            💡 Gunakan tombol panah untuk melihat foto berikutnya • Kualitas foto asli dipertahankan tanpa kompresi
          </div>
        </div>
      )}
    </div>
  );
};
