import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Download, 
  Share2, 
  Lock, 
  Unlock, 
  Grid, 
  Layers, 
  Phone, 
  Instagram, 
  Globe, 
  Calendar, 
  User, 
  Sparkles, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  FileArchive, 
  Copy, 
  QrCode,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Ban,
  ShieldCheck,
  Heart,
  Maximize2,
  HelpCircle,
  MapPin,
  Mail,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import JSZip from 'jszip';
import { Album, Photo, StudioProfile } from '../types';
import { 
  fetchPublicGalleryBySlug,
  incrementGalleryView, 
  incrementGalleryDownload,
  PublicGalleryBundle
} from '../services/storageService';
import { 
  getPublicPhotoUrl, 
  resolveDirectPhotoUrl,
  downloadOriginalPhotoFile,
  downloadOriginalPhotosZip
} from '../services/photoService';
import { getPublicGalleryUrl } from '../services/urlHelper';
import { CustomerPhotoLightbox } from './CustomerPhotoLightbox';
import { CustomerPhotoCard4x6 } from './CustomerPhotoCard4x6';

interface PublicCustomerGalleryProps {
  galleryId: string;
  onBackToStudio?: () => void;
}

export const PublicCustomerGallery: React.FC<PublicCustomerGalleryProps> = ({
  galleryId,
  onBackToStudio,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [fetchStatus, setFetchStatus] = useState<'loading' | 'ok' | 'not_found' | 'disabled' | 'expired'>('loading');
  const [bundle, setBundle] = useState<PublicGalleryBundle | null>(null);

  const [isLocked, setIsLocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [viewLayout, setViewLayout] = useState<'grid' | 'masonry'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('galleryViewLayout');
      if (saved === 'masonry' || saved === 'grid') {
        return saved;
      }
    }
    return 'grid';
  });

  // Mobile & responsive grid columns: 1 | 2 | 3 | 4 (Default is 3x3 for mobile smartphone)
  const [gridCols, setGridCols] = useState<1 | 2 | 3 | 4>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('galleryGridColumns');
      if (saved && ['1', '2', '3', '4'].includes(saved)) {
        return Number(saved) as 1 | 2 | 3 | 4;
      }
    }
    return 3; // Default 3x3 as requested
  });

  const [isGridMenuOpen, setIsGridMenuOpen] = useState(false);
  const [qualityMode, setQualityMode] = useState<'hd' | 'light'>('hd');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [photoRotations, setPhotoRotations] = useState<Record<string, number>>({});
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ percent: number; currentFileName: string } | null>(null);
  const [downloadErrorBanner, setDownloadErrorBanner] = useState<{ message: string; photo?: Photo; isZip?: boolean } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>('all');

  // Safely extract active photos from bundle with useMemo at the top level
  const activePhotos = React.useMemo(() => {
    if (!bundle || !bundle.photos) return [];
    return (bundle.photos || []).filter((p) => !p.isDeleted);
  }, [bundle]);

  // Extract unique folders for customer category pills
  const availableFolders = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of activePhotos) {
      if (p.folderName && p.folderName.trim() && p.folderName !== 'Foto Langsung') {
        set.add(p.folderName.trim());
      }
    }
    return Array.from(set);
  }, [activePhotos]);

  // Displayed photos according to active folder filter
  const displayedPhotos = React.useMemo(() => {
    if (selectedFolderFilter === 'all') return activePhotos;
    return activePhotos.filter((p) => p.folderName === selectedFolderFilter);
  }, [activePhotos, selectedFolderFilter]);

  const handleRotatePhoto = (photoId: string, newRotation: number) => {
    setPhotoRotations((prev) => ({
      ...prev,
      [photoId]: newRotation,
    }));
  };

  const handleSelectGridCols = (cols: 1 | 2 | 3 | 4) => {
    setGridCols(cols);
    setViewLayout('grid');
    if (typeof window !== 'undefined') {
      localStorage.setItem('galleryGridColumns', String(cols));
      localStorage.setItem('galleryViewLayout', 'grid');
    }
    setIsGridMenuOpen(false);
  };

  const handleSelectLayout = (layout: 'grid' | 'masonry') => {
    setViewLayout(layout);
    if (typeof window !== 'undefined') {
      localStorage.setItem('galleryViewLayout', layout);
    }
    setIsGridMenuOpen(false);
  };

  const loadGalleryData = async () => {
    setIsLoading(true);
    setFetchStatus('loading');
    setLogoError(false);
    const normalizedId = (galleryId || '').trim().toUpperCase();

    try {
      const data = await fetchPublicGalleryBySlug(normalizedId);

      console.log(`[PUBLIC GALLERY DEBUG]
Gallery ID: ${galleryId}
Normalized Gallery ID: ${normalizedId}
Current URL: ${typeof window !== 'undefined' ? window.location.href : ''}
Database lookup: /api/public/gallery/${normalizedId}
Record exists: ${Boolean(data)}
isPublished: ${Boolean(data?.album?.isPublished ?? true)}
Album ID: ${data?.album?.id}
Owner UID: ${data?.album?.ownerId}
Photo count: ${data?.photos?.length || 0}`);

      if (data && data.album) {
        setBundle(data);
        
        if (data.status === 'disabled' || data.album.isDeleted) {
          setFetchStatus('disabled');
        } else if (data.status === 'expired' || (data.album.expiresAt && new Date(data.album.expiresAt) < new Date())) {
          setFetchStatus('expired');
        } else {
          setFetchStatus('ok');
          const isProtected = Boolean(data.album.isPasswordProtected || (data.album as any).pinEnabled);
          const pin = data.album.passwordHash || (data.album as any).pinHash;
          if (isProtected && pin) {
            setIsLocked(true);
          } else {
            setIsLocked(false);
          }
          setQualityMode(data.album.displayQuality === 'light' ? 'light' : 'hd');
          incrementGalleryView(normalizedId);
        }
      } else {
        setFetchStatus('not_found');
      }
    } catch (err) {
      console.error('[PublicCustomerGallery] Error loading gallery:', err);
      setFetchStatus('not_found');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGalleryData();
  }, [galleryId]);

  // 1. Loading State
  if (isLoading || fetchStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#FFFFFF] text-[#111827] flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-[#FFFFFF] border border-[#E5EAF0] p-8 rounded-[22px] shadow-sm space-y-4 animate-in fade-in duration-200">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#E8F7F6] text-[#0796A6] flex items-center justify-center border border-[#0796A6]/20">
            <RefreshCw className="w-6 h-6 animate-spin text-[#0796A6]" />
          </div>
          <h2 className="text-xl font-bold text-[#0B1830] font-serif">Memuat Galeri Foto...</h2>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Menghubungkan ke server cloud galeri dan mengambil koleksi momen eksklusif Anda.
          </p>
          <div className="w-24 h-1 bg-[#E5EAF0] rounded-full mx-auto overflow-hidden">
            <div className="w-full h-full bg-[#0796A6] animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // 2. Disabled / Deleted State
  if (fetchStatus === 'disabled') {
    return (
      <div className="min-h-screen bg-[#F7F9FC] text-[#111827] flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full space-y-5 bg-[#FFFFFF] border border-[#E5EAF0] p-8 rounded-[22px] shadow-sm">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
            <Ban className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-[#0B1830] font-serif">Galeri Tidak Aktif</h2>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Galeri foto ini sedang dinonaktifkan sementara atau telah dipindahkan ke arsip oleh pihak studio.
          </p>
          {bundle?.studio?.whatsappNumber && (
            <a
              href={`https://wa.me/${bundle.studio.whatsappNumber}?text=Halo%20${encodeURIComponent(bundle.studio.studioName || '')},%20saya%20ingin%20menanyakan%20status%20galeri%20ID:%20${encodeURIComponent(galleryId)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0B1830] to-[#0796A6] text-white text-xs font-semibold hover:opacity-95 transition shadow-sm"
            >
              <Phone className="w-4 h-4" />
              <span>Hubungi {bundle.studio.studioName || 'Studio'}</span>
            </a>
          )}
          {onBackToStudio && (
            <div className="pt-2">
              <button
                onClick={onBackToStudio}
                className="text-xs text-[#64748B] hover:text-[#0B1830] underline cursor-pointer"
              >
                Kembali ke Dashboard Studio
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. Expired State
  if (fetchStatus === 'expired') {
    return (
      <div className="min-h-screen bg-[#F7F9FC] text-[#111827] flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full space-y-5 bg-[#FFFFFF] border border-[#E5EAF0] p-8 rounded-[22px] shadow-sm">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
            <Clock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-[#0B1830] font-serif">Galeri Telah Berakhir</h2>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Masa aktif akses online untuk galeri <strong className="text-[#0B1830]">{bundle?.album.eventName}</strong> telah berakhir pada {bundle?.album.expiresAt ? new Date(bundle.album.expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'waktu yang ditentukan'}.
          </p>
          {bundle?.studio?.whatsappNumber && (
            <a
              href={`https://wa.me/${bundle.studio.whatsappNumber}?text=Halo%20${encodeURIComponent(bundle.studio.studioName || '')},%20saya%20ingin%20memperpanjang%20akses%20galeri%20${encodeURIComponent(bundle?.album.eventName || '')}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0B1830] to-[#0796A6] text-white text-xs font-semibold hover:opacity-95 transition shadow-sm"
            >
              <Phone className="w-4 h-4" />
              <span>Hubungi Studio untuk Perpanjangan</span>
            </a>
          )}
          {onBackToStudio && (
            <div className="pt-2">
              <button
                onClick={onBackToStudio}
                className="text-xs text-[#64748B] hover:text-[#0B1830] underline cursor-pointer"
              >
                Kembali ke Dashboard Studio
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. Not Found / Error State
  if (fetchStatus === 'not_found' || !bundle || !bundle.album) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] text-[#111827] flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full space-y-5 bg-[#FFFFFF] border border-[#E5EAF0] p-8 rounded-[22px] shadow-sm">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#E8F7F6] text-[#0796A6] flex items-center justify-center border border-[#0796A6]/20">
            <Camera className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-[#0B1830] font-serif">Galeri Tidak Ditemukan</h2>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Tautan galeri dengan ID <span className="font-mono font-bold text-[#0B1830] bg-[#F7F9FC] px-2 py-1 rounded border border-[#E5EAF0]">{galleryId}</span> tidak terdaftar atau album belum dipublikasikan oleh studio.
          </p>
          
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={loadGalleryData}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#F7F9FC] text-[#0B1830] text-xs font-semibold border border-[#E5EAF0] transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#0796A6]" />
              <span>Coba Muat Ulang</span>
            </button>

            {onBackToStudio && (
              <button
                onClick={onBackToStudio}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0B1830] to-[#0796A6] text-white text-xs font-semibold hover:opacity-95 transition cursor-pointer shadow-sm"
              >
                Ke Dashboard Studio
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const { album, studio } = bundle;

  const handleUnlockPIN = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPin = (album.passwordHash || (album as any).pinHash || '').trim();
    if (pinInput.trim() === correctPin) {
      setIsLocked(false);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const publicShareUrl = getPublicGalleryUrl(galleryId || album?.galleryId || '', studio?.customGalleryDomain);

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(publicShareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = `Halo! Buka galeri foto ${album.eventName} (${album.customerName}) di sini: ${publicShareUrl}${
      album.isPasswordProtected ? ` (PIN: ${album.passwordHash})` : ''
    }`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleDownloadAllZip = async () => {
    if (activePhotos.length === 0) return;
    setIsZipping(true);
    setDownloadErrorBanner(null);
    incrementGalleryDownload(galleryId);

    const cleanEvent = (album.eventName || 'Galeri').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanCustomer = (album.customerName || 'Foto').replace(/[^a-zA-Z0-9_-]/g, '_');
    const zipFilename = `${cleanEvent}_${cleanCustomer}_Foto_Original.zip`;

    try {
      await downloadOriginalPhotosZip(
        activePhotos,
        zipFilename,
        (percent, currentFileName) => {
          setZipProgress({ percent, currentFileName });
        },
        galleryId
      );
    } catch (err: any) {
      console.error('[Gallery ZIP Download Error]', err);
      setDownloadErrorBanner({
        message: 'File original tidak dapat diunduh. Silakan coba kembali.',
        isZip: true,
      });
    } finally {
      setIsZipping(false);
      setZipProgress(null);
    }
  };

  const handleSingleDownload = async (photo: Photo) => {
    incrementGalleryDownload(galleryId);
    setDownloadErrorBanner(null);
    try {
      await downloadOriginalPhotoFile(photo, galleryId);
    } catch (err: any) {
      console.error('[Gallery Single Download Error]', err);
      setDownloadErrorBanner({
        message: 'File original tidak dapat diunduh. Silakan coba kembali.',
        photo,
      });
    }
  };

  // PIN Unlock Screen (Modern Premium Photography Gallery)
  if (isLocked) {
    const studioLogoUrl = studio.studioLogoUrl || studio.logoUrl;
    const studioNameText = studio.studioName || 'Studio Foto';
    const studioTaglineText = studio.tagline || 'Professional Photography';

    return (
      <div className="min-h-screen bg-[#F6F8FB] text-[#111827] flex items-center justify-center p-4 sm:p-6 font-sans">
        <div className="w-full max-w-[460px] bg-[#FFFFFF] border border-[#E6EBF2] rounded-[24px] p-6 sm:p-9 shadow-lg shadow-slate-900/5 text-center space-y-4 sm:space-y-5 animate-in fade-in zoom-in-95 duration-200">
          
          {/* 1. STUDIO LOGO (No container, no border, transparent PNG) */}
          <div className="flex justify-center items-center min-h-[60px] pt-1">
            {studioLogoUrl && !logoError ? (
              <img
                src={studioLogoUrl}
                alt={studioNameText}
                className="h-16 sm:h-20 max-w-[140px] sm:max-w-[170px] object-contain"
                referrerPolicy="no-referrer"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="text-[#0796A6] flex items-center justify-center">
                <Camera className="w-10 h-10 sm:w-12 sm:h-12" strokeWidth={1.75} />
              </div>
            )}
          </div>

          {/* 2. NAMA STUDIO & TAGLINE */}
          <div className="space-y-0.5">
            <h1 className="text-xl sm:text-[23px] font-bold text-[#08162F] tracking-tight leading-tight uppercase font-sans">
              {studioNameText}
            </h1>
            <p className="text-xs sm:text-[14px] font-normal text-[#64748B] tracking-normal">
              {studioTaglineText}
            </p>
          </div>

          {/* 3. BADGE GALERI TERPROTEKSI */}
          <div className="pt-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F7F6] text-[#0796A6] text-[11px] sm:text-xs font-semibold tracking-wide">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>GALERI TERPROTEKSI</span>
            </span>
          </div>

          {/* 4. JUDUL GALERI (Lebih kecil & formal) */}
          <div>
            <h2 className="text-base sm:text-[19px] font-bold text-[#0B1830] tracking-tight">
              {album.eventName}
            </h2>
          </div>

          {/* 5. PEMISAH (garis tipis — ♥ — garis tipis) */}
          <div className="flex items-center justify-center gap-3 text-[#0796A6]/70 my-1">
            <span className="h-px w-10 sm:w-14 bg-[#E6EBF2]"></span>
            <Heart className="w-3 h-3 fill-current text-[#0796A6]/60" />
            <span className="h-px w-10 sm:w-14 bg-[#E6EBF2]"></span>
          </div>

          {/* 6. INFORMASI PROTEKSI */}
          <p className="text-xs sm:text-[13px] text-[#64748B] leading-relaxed">
            Galeri foto ini diproteksi dengan PIN oleh <strong className="font-semibold text-[#08162F]">{studioNameText}</strong>.
          </p>

          {/* 7 & 8. FORM INPUT PIN & TOMBOL UTAMA */}
          <form onSubmit={handleUnlockPIN} className="space-y-3.5 pt-1">
            <div>
              <input
                type="password"
                required
                autoFocus
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Masukkan PIN Akses..."
                className="w-full text-center h-12 sm:h-[50px] px-4 bg-white border border-[#E6EBF2] focus:border-[#0796A6] focus:ring-2 focus:ring-[#0796A6]/10 rounded-xl text-sm sm:text-base text-[#0B1830] focus:outline-none font-mono tracking-widest transition shadow-2xs placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400"
              />
              {pinError && (
                <p className="text-xs text-rose-600 mt-2 flex items-center justify-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" /> PIN salah. Silakan hubungi studio Anda.
                </p>
              )}
            </div>

            <button
              id="btn-unlock-pin"
              type="submit"
              className="w-full h-12 sm:h-[50px] rounded-xl font-semibold text-sm bg-gradient-to-r from-[#08162F] to-[#0796A6] hover:opacity-95 text-white shadow-sm hover:shadow transition transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Buka Galeri Foto</span>
            </button>
          </form>

          {/* 9. BANTUAN WHATSAPP */}
          {studio.whatsappNumber ? (
            <p className="text-xs sm:text-[13px] text-[#64748B] pt-1">
              Lupa PIN?{' '}
              <a
                href={`https://wa.me/${studio.whatsappNumber}?text=Halo%20${encodeURIComponent(studioNameText)},%20saya%20ingin%20menanyakan%20PIN%20galeri%20${encodeURIComponent(album.eventName)}`}
                target="_blank"
                rel="noreferrer"
                className="text-[#0796A6] hover:underline font-semibold"
              >
                Hubungi Studio via WhatsApp
              </a>
            </p>
          ) : (
            <p className="text-xs sm:text-[13px] text-[#64748B] pt-1">
              Lupa PIN? Silakan hubungi studio fotografer Anda.
            </p>
          )}
        </div>
      </div>
    );
  }

  const studioNameDisplay = studio.studioName || 'SUMEKAR PHOTOGRAPHY';
  const studioLogoUrl = studio.studioLogoUrl || studio.logoUrl;

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#111827] font-sans antialiased selection:bg-[#0796A6] selection:text-white">
      
      {/* ========================================================================= */}
      {/* 2. HEADER PREMIUM (Deep Navy + Dynamic Studio Branding + Curved Geometric Edge) */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-[#FFFFFF] border-b border-[#E6EBF2] shadow-2xs select-none transition">
        <div className="relative w-full h-[72px] sm:h-20 lg:h-[92px] flex items-center justify-between overflow-hidden">
          
          {/* ------------------------------------------------------------- */}
          {/* DEEP NAVY GEOMETRIC BRAND AREA (Left ~60-65% on Desktop)       */}
          {/* ------------------------------------------------------------- */}
          <div className="absolute inset-y-0 left-0 w-full md:w-[64%] lg:w-[62%] xl:w-[58%] z-0 pointer-events-none">
            {/* SVG Diagonal + Curved Geometric Shape with Linear Gradient */}
            <svg 
              className="w-full h-full block" 
              viewBox="0 0 1000 100" 
              preserveAspectRatio="none"
              fill="none"
            >
              <defs>
                <linearGradient id="headerNavyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#07152D" />
                  <stop offset="50%" stopColor="#08162F" />
                  <stop offset="100%" stopColor="#0B1D3A" />
                </linearGradient>
              </defs>
              {/* Smooth Diagonal Path with Bezier Curved Corners */}
              <path 
                d="M 0,0 L 965,0 C 980,0 990,5 984,18 L 948,84 C 943,94 933,100 920,100 L 0,100 Z" 
                fill="url(#headerNavyGrad)" 
              />
            </svg>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* LEFT: STUDIO BRANDING CONTENT (Logo + Name + Tagline)          */}
          {/* ------------------------------------------------------------- */}
          <div className="relative z-10 h-full flex items-center pl-4 sm:pl-8 lg:pl-12 pr-4 sm:pr-8 max-w-[85%] md:max-w-[60%] lg:max-w-[58%]">
            <div className="flex items-center gap-3 sm:gap-4 lg:gap-5 min-w-0">
              
              {/* Studio Logo Container (Balanced Size: 42px on Mobile, 56-64px on Desktop) */}
              {studioLogoUrl && !logoError ? (
                <div className="w-10 h-10 sm:w-13 sm:h-13 lg:w-16 lg:h-16 rounded-xl sm:rounded-2xl bg-white/10 sm:bg-white/95 p-1 sm:p-1.5 flex items-center justify-center shrink-0 shadow-xs border border-white/20 sm:border-white overflow-hidden">
                  <img
                    src={studioLogoUrl}
                    alt={studioNameDisplay}
                    className="max-h-8 sm:max-h-10 lg:max-h-12 max-w-full object-contain"
                    referrerPolicy="no-referrer"
                    onError={() => setLogoError(true)}
                  />
                </div>
              ) : (
                <div className="w-10 h-10 sm:w-13 sm:h-13 lg:w-16 lg:h-16 rounded-xl sm:rounded-2xl bg-white/10 border border-white/20 text-[#E8F7F6] flex items-center justify-center shrink-0 shadow-inner">
                  <Camera className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-teal-400" />
                </div>
              )}

              {/* Studio Typography */}
              <div className="min-w-0 flex flex-col justify-center">
                <h1 className="font-bold text-white text-sm sm:text-base md:text-lg lg:text-[21px] tracking-tight leading-tight uppercase font-sans truncate drop-shadow-xs">
                  {studioNameDisplay}
                </h1>
                <p className="text-[11px] sm:text-xs lg:text-[13px] font-normal sm:font-medium text-white/80 tracking-wide leading-normal truncate mt-0.5">
                  {studio.tagline || 'Official Photo Gallery'}
                </p>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* RIGHT: ACTION AREA (White background, Bagikan, Dashboard)      */}
          {/* ------------------------------------------------------------- */}
          <div className="relative z-10 h-full flex items-center justify-end pr-3 sm:pr-6 lg:pr-10 gap-2 sm:gap-3 shrink-0">
            
            {/* WhatsApp Contact (if studio configured phone) */}
            {studio.whatsappNumber && (
              <a
                href={`https://wa.me/${studio.whatsappNumber}?text=Halo%20${encodeURIComponent(studioNameDisplay)},%20saya%20sedang%20melihat%20galeri%20${encodeURIComponent(album.eventName)}`}
                target="_blank"
                rel="noreferrer"
                className="hidden lg:flex items-center gap-2 h-11 lg:h-12 px-3.5 lg:px-4 rounded-xl bg-white hover:bg-[#F7F9FC] text-[#0796A6] border border-[#E6EBF2] hover:border-[#0796A6]/40 text-xs sm:text-sm font-semibold transition shadow-2xs"
                title="Hubungi Studio via WhatsApp"
              >
                <Phone className="w-4 h-4 text-[#0796A6]" />
                <span className="hidden xl:inline">WhatsApp</span>
              </a>
            )}

            {/* Bagikan Button (White background, navy border/text) */}
            <button
              id="btn-header-share-gallery"
              type="button"
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-2 h-9 sm:h-11 lg:h-12 px-3 sm:px-4 lg:px-5 rounded-lg sm:rounded-xl bg-white hover:bg-[#F7F9FC] text-[#0B1830] text-xs sm:text-sm font-semibold border border-[#E6EBF2] sm:border-[#E6EBF2] hover:border-[#0B1830]/30 transition cursor-pointer shadow-2xs active:scale-98"
            >
              <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#0796A6]" />
              <span className="hidden sm:inline">Bagikan</span>
            </button>

            {/* Dashboard Studio Button (Deep Navy, white text) */}
            {onBackToStudio ? (
              <button
                id="btn-header-studio-dashboard"
                type="button"
                onClick={onBackToStudio}
                className="hidden md:flex items-center gap-2 h-11 lg:h-12 px-4 lg:px-5 rounded-xl bg-[#08162F] hover:bg-[#0B1D3A] text-white text-xs sm:text-sm font-semibold border border-[#08162F] transition cursor-pointer shadow-xs active:scale-98"
              >
                <Grid className="w-4 h-4 text-teal-400" />
                <span>Dashboard Studio</span>
              </button>
            ) : (
              <a
                href="/"
                className="hidden md:flex items-center gap-2 h-11 lg:h-12 px-4 lg:px-5 rounded-xl bg-[#08162F] hover:bg-[#0B1D3A] text-white text-xs sm:text-sm font-semibold border border-[#08162F] transition cursor-pointer shadow-xs active:scale-98"
              >
                <Grid className="w-4 h-4 text-teal-400" />
                <span>Dashboard Studio</span>
              </a>
            )}
          </div>

        </div>
      </header>

      {/* ========================================================================= */}
      {/* 3 & 5. HERO ALBUM (Editorial Serif + Navy & Teal Glow + Abstract Botanicals) */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden bg-[#FFFFFF] py-12 sm:py-18 px-4 sm:px-8 border-b border-[#E5EAF0]">
        
        {/* Soft Radial Glow */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 50% 15%, rgba(7, 150, 166, 0.06) 0%, rgba(20, 115, 230, 0.03) 45%, transparent 75%)'
          }}
        />

        {/* Abstract Minimal Botanical Motif - Top Left (Samar & Elegan) */}
        <svg 
          className="absolute top-0 left-0 w-36 sm:w-56 h-36 sm:h-56 text-[#0796A6] opacity-[0.04] pointer-events-none -translate-x-6 -translate-y-6"
          viewBox="0 0 200 200" 
          fill="currentColor"
        >
          <path d="M42.7,-72.2C54.6,-66.1,63.1,-53.4,69.5,-40.1C75.9,-26.8,80.1,-13.4,79.8,-0.2C79.4,13,74.5,26,67.3,38.1C60.1,50.2,50.7,61.4,38.8,69.3C26.9,77.2,12.5,81.8,-1.5,84.4C-15.5,87,-31,87.6,-43.8,80.8C-56.6,74,-66.7,59.8,-74.6,44.9C-82.5,30,-88.2,15,-87.3,0.5C-86.4,-14,-78.9,-28,-69.5,-39.8C-60.1,-51.6,-48.8,-61.2,-36.2,-67C-23.6,-72.8,-11.8,-74.8,1.4,-77.2C14.6,-79.6,30.8,-78.3,42.7,-72.2Z" transform="translate(100 100)" />
        </svg>

        {/* Abstract Minimal Botanical Motif - Top Right (Samar & Elegan) */}
        <svg 
          className="absolute top-0 right-0 w-36 sm:w-56 h-36 sm:h-56 text-[#0B1830] opacity-[0.03] pointer-events-none translate-x-6 -translate-y-6"
          viewBox="0 0 200 200" 
          fill="currentColor"
        >
          <path d="M47.7,-64.4C61.3,-56.3,71.5,-41.8,76.4,-25.7C81.3,-9.6,80.9,8.1,75.4,24.2C69.9,40.3,59.3,54.8,45.3,64.2C31.3,73.6,13.9,77.9,-3.1,83.3C-20.1,88.7,-36.7,95.2,-49.6,88.4C-62.5,81.6,-71.7,61.5,-77.9,42.4C-84.1,23.3,-87.3,5.2,-83.4,-10.8C-79.5,-26.8,-68.5,-40.7,-55,-48.9C-41.5,-57.1,-25.5,-59.6,-9.8,-63.9C5.9,-68.2,34.1,-72.5,47.7,-64.4Z" transform="translate(100 100)" />
        </svg>

        <div className="relative max-w-4xl mx-auto text-center space-y-5 z-10">
          
          {/* Badge: DOKUMENTASI EKSKLUSIF PELANGGAN */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#E8F7F6] border border-[#0796A6]/20 text-xs text-[#0796A6] font-bold tracking-wide shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-[#0796A6]" />
            <span>DOKUMENTASI EKSKLUSIF PELANGGAN</span>
          </div>

          {/* Large Album Title in Editorial Modern Serif */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-serif text-[#0B1830] tracking-tight font-normal leading-tight px-2">
            {album.eventName}
          </h1>

          {/* Delicate Divider with Heart Icon */}
          <div className="flex items-center justify-center gap-3 py-1">
            <div className="w-16 sm:w-24 h-[1px] bg-gradient-to-r from-transparent to-[#0796A6]/40" />
            <Heart className="w-3.5 h-3.5 text-[#0796A6]/70 fill-[#0796A6]/20" />
            <div className="w-16 sm:w-24 h-[1px] bg-gradient-to-l from-transparent to-[#0796A6]/40" />
          </div>

          {/* Horizontal Metadata */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-5 text-xs sm:text-sm text-[#64748B] font-medium">
            <span className="flex items-center gap-1.5 text-[#111827] font-semibold">
              <User className="w-4 h-4 text-[#0796A6]" />
              <span>{album.customerName}</span>
            </span>
            <span className="text-[#E5EAF0]">|</span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#64748B]" />
              <span>
                {album.eventDate ? new Date(album.eventDate).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }) : 'Hari Bahagia'}
              </span>
            </span>
            <span className="text-[#E5EAF0]">|</span>
            <span className="flex items-center gap-1.5 text-[#00A86B] font-semibold">
              <CheckCircle2 className="w-4 h-4 text-[#00A86B]" />
              <span>{activePhotos.length} Foto Siap Diunduh</span>
            </span>
          </div>

          {/* Description */}
          {album.description && (
            <p className="text-xs sm:text-sm text-[#64748B] max-w-xl mx-auto italic leading-relaxed pt-1">
              "{album.description}"
            </p>
          )}

          {/* 4. TOMBOL UTAMA (Primary: Gradient Navy to Teal, Secondary: White with Thin Border) */}
          <div className="pt-3 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {studio.allowBatchZipDownload !== false && (
              <button
                onClick={handleDownloadAllZip}
                disabled={isZipping || activePhotos.length === 0}
                className="flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 rounded-[14px] font-semibold text-xs sm:text-sm bg-gradient-to-r from-[#0B1830] via-[#101A35] to-[#0796A6] hover:from-[#101A35] hover:to-[#088392] text-white shadow-md hover:shadow-lg transition-all duration-200 transform active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                <FileArchive className="w-4 h-4" />
                <span>{isZipping ? 'Menyiapkan File ZIP...' : 'Download Semua Foto (ZIP)'}</span>
              </button>
            )}

            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-[14px] font-semibold text-xs sm:text-sm bg-[#FFFFFF] hover:bg-[#F7F9FC] text-[#111827] border border-[#E5EAF0] hover:border-[#0796A6]/50 transition-all duration-200 shadow-xs hover:shadow-sm cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-[#0796A6]" />
              <span>Bagikan QR / Link</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 6. TRUST / BENEFIT CARD (4 Columns with Pastel Accent Circles) */}
        {/* ========================================================================= */}
        <div className="max-w-6xl mx-auto mt-10 sm:mt-14">
          <div className="bg-[#F7F9FC] border border-[#E5EAF0] rounded-[22px] p-6 sm:p-8 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
              
              {/* Feature 1: Aman & Privat */}
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#E8F7F6] text-[#0796A6] flex items-center justify-center shrink-0 border border-[#0796A6]/15">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0B1830] text-sm leading-snug">Aman & Privat</h3>
                  <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                    Hanya pelanggan dengan akses yang dapat melihat foto.
                  </p>
                </div>
              </div>

              {/* Feature 2: Kualitas Original */}
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#EEF4FF] text-[#1473E6] flex items-center justify-center shrink-0 border border-[#1473E6]/15">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0B1830] text-sm leading-snug">Kualitas Original</h3>
                  <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                    Semua foto tersedia dalam resolusi asli terbaik.
                  </p>
                </div>
              </div>

              {/* Feature 3: Akses Mudah */}
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#E6F8F0] text-[#00A86B] flex items-center justify-center shrink-0 border border-[#00A86B]/15">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0B1830] text-sm leading-snug">Akses Mudah</h3>
                  <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                    Unduh cepat semua foto dalam satu klik.
                  </p>
                </div>
              </div>

              {/* Feature 4: Kenangan Berharga */}
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#FAF0F5] text-[#D946EF] flex items-center justify-center shrink-0 border border-[#D946EF]/15">
                  <Heart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0B1830] text-sm leading-snug">Kenangan Berharga</h3>
                  <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                    Simpan momen spesial ini selamanya.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>

      </section>

      {/* ========================================================================= */}
      {/* 7. KOLEKSI FOTO (Compact Toolbar & Mobile Responsive Grid)                */}
      {/* ========================================================================= */}
      <main className="max-w-7xl mx-auto px-3 sm:px-8 py-6 sm:py-10">
        
        {/* Compact Toolbar */}
        <div className="sticky top-[72px] sm:top-20 lg:top-[92px] z-30 bg-[#FFFFFF]/95 backdrop-blur-md -mx-3 sm:-mx-8 px-3 sm:px-8 py-2.5 sm:py-3 border-y sm:border-t-0 sm:border-b border-[#E5EAF0] shadow-2xs transition-all">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
            
            {/* Left: Title & Photo Count */}
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="font-bold text-[#0B1830] text-sm sm:text-base md:text-lg font-serif truncate">
                Koleksi Foto
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#E8F7F6] text-[#0796A6] text-[10px] sm:text-xs font-bold shrink-0">
                {activePhotos.length} Foto
              </span>
            </div>

            {/* Right: Controls (Quality Switcher + Grid Selector Button) */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              
              {/* 1. Quality Switcher: HD Asli | ⚡ Ringan */}
              <div className="flex bg-[#F7F9FC] p-0.5 sm:p-1 rounded-xl border border-[#E5EAF0] text-[11px] sm:text-xs font-medium">
                <button
                  id="btn-quality-hd"
                  type="button"
                  onClick={() => setQualityMode('hd')}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    qualityMode === 'hd'
                      ? 'bg-[#FFFFFF] text-[#0B1830] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0B1830]'
                  }`}
                  title="Tampilkan foto dalam kualitas HD Asli"
                >
                  <span>HD Asli</span>
                </button>
                <button
                  id="btn-quality-light"
                  type="button"
                  onClick={() => setQualityMode('light')}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg font-semibold transition flex items-center gap-1 cursor-pointer ${
                    qualityMode === 'light'
                      ? 'bg-[#FFFFFF] text-[#0B1830] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0B1830]'
                  }`}
                  title="Mode Cepat & Hemat Kuota"
                >
                  <Zap className="w-3 h-3 text-[#0796A6]" />
                  <span className="hidden xs:inline">Ringan</span>
                </button>
              </div>

              {/* 2. Grid Selector Trigger Button (Opens Popover / Bottom Sheet) */}
              <div className="relative">
                <button
                  id="btn-grid-selector"
                  type="button"
                  onClick={() => setIsGridMenuOpen(!isGridMenuOpen)}
                  className={`flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl border text-xs font-semibold transition cursor-pointer shadow-2xs ${
                    isGridMenuOpen 
                      ? 'bg-[#0B1830] text-white border-[#0B1830]' 
                      : 'bg-[#FFFFFF] hover:bg-[#F7F9FC] text-[#0B1830] border-[#E5EAF0] hover:border-[#0796A6]/40'
                  }`}
                  title="Atur Jumlah Kolom & Tampilan Grid"
                >
                  {/* Visual column icon */}
                  {viewLayout === 'masonry' ? (
                    <Layers className="w-3.5 h-3.5 text-[#0796A6]" />
                  ) : gridCols === 1 ? (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.75" />
                    </svg>
                  ) : gridCols === 2 ? (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="2" y="2" width="5.2" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      <rect x="8.8" y="2" width="5.2" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  ) : gridCols === 3 ? (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="1.5" y="2" width="3.5" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
                      <rect x="6.25" y="2" width="3.5" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
                      <rect x="11" y="2" width="3.5" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="1" y="2" width="2.6" height="12" rx="0.75" fill="none" stroke="currentColor" strokeWidth="1.2" />
                      <rect x="4.8" y="2" width="2.6" height="12" rx="0.75" fill="none" stroke="currentColor" strokeWidth="1.2" />
                      <rect x="8.6" y="2" width="2.6" height="12" rx="0.75" fill="none" stroke="currentColor" strokeWidth="1.2" />
                      <rect x="12.4" y="2" width="2.6" height="12" rx="0.75" fill="none" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                  )}
                  <span>{viewLayout === 'masonry' ? 'Masonry' : `Grid ${gridCols}×${gridCols}`}</span>
                </button>

                {/* Dropdown Popover */}
                {isGridMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40"
                      onClick={() => setIsGridMenuOpen(false)} 
                    />

                    <div className="absolute right-0 top-full mt-2 w-64 bg-[#FFFFFF] border border-[#E5EAF0] rounded-2xl shadow-xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-3 py-2 border-b border-[#E5EAF0]/80">
                        <span className="text-[11px] font-bold text-[#08162F] uppercase tracking-wider block">
                          Tampilan Galeri
                        </span>
                        <span className="text-[10px] text-[#64748B] block mt-0.5">
                          Atur jumlah foto dalam satu baris
                        </span>
                      </div>

                      {/* 1x1 — Foto Besar */}
                      <button
                        id="opt-grid-1"
                        type="button"
                        onClick={() => handleSelectGridCols(1)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                          gridCols === 1 && viewLayout === 'grid'
                            ? 'bg-[#E8F7F6] text-[#0796A6]'
                            : 'text-[#0B1830] hover:bg-[#F7F9FC]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-5 h-5 flex items-center justify-center text-current">
                            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                              <rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.75" />
                            </svg>
                          </div>
                          <span>▣ 1 Kolom (1×1 — Foto Besar)</span>
                        </div>
                        {gridCols === 1 && viewLayout === 'grid' && <Check className="w-4 h-4 text-[#0796A6]" />}
                      </button>

                      {/* 2x2 — Grid Sedang */}
                      <button
                        id="opt-grid-2"
                        type="button"
                        onClick={() => handleSelectGridCols(2)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                          gridCols === 2 && viewLayout === 'grid'
                            ? 'bg-[#E8F7F6] text-[#0796A6]'
                            : 'text-[#0B1830] hover:bg-[#F7F9FC]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-5 h-5 flex items-center justify-center text-current">
                            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                              <rect x="2" y="2" width="5.2" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                              <rect x="8.8" y="2" width="5.2" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            </svg>
                          </div>
                          <span>▦ 2 Kolom (2×2 — Grid Sedang)</span>
                        </div>
                        {gridCols === 2 && viewLayout === 'grid' && <Check className="w-4 h-4 text-[#0796A6]" />}
                      </button>

                      {/* 3x3 — Grid Compact (Default Mobile) */}
                      <button
                        id="opt-grid-3"
                        type="button"
                        onClick={() => handleSelectGridCols(3)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                          gridCols === 3 && viewLayout === 'grid'
                            ? 'bg-[#E8F7F6] text-[#0796A6]'
                            : 'text-[#0B1830] hover:bg-[#F7F9FC]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-5 h-5 flex items-center justify-center text-current">
                            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                              <rect x="1.5" y="2" width="3.5" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
                              <rect x="6.25" y="2" width="3.5" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
                              <rect x="11" y="2" width="3.5" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
                            </svg>
                          </div>
                          <span className="flex items-center gap-1.5">
                            <span>▦ 3 Kolom (Compact)</span>
                            <span className="text-[9px] px-1.5 py-0.2 bg-[#0796A6]/10 text-[#0796A6] rounded font-bold">Default</span>
                          </span>
                        </div>
                        {gridCols === 3 && viewLayout === 'grid' && <Check className="w-4 h-4 text-[#0796A6]" />}
                      </button>

                      {/* 4x4 — Grid Mini */}
                      <button
                        id="opt-grid-4"
                        type="button"
                        onClick={() => handleSelectGridCols(4)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                          gridCols === 4 && viewLayout === 'grid'
                            ? 'bg-[#E8F7F6] text-[#0796A6]'
                            : 'text-[#0B1830] hover:bg-[#F7F9FC]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-5 h-5 flex items-center justify-center text-current">
                            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                              <rect x="1" y="2" width="2.6" height="12" rx="0.75" fill="none" stroke="currentColor" strokeWidth="1.2" />
                              <rect x="4.8" y="2" width="2.6" height="12" rx="0.75" fill="none" stroke="currentColor" strokeWidth="1.2" />
                              <rect x="8.6" y="2" width="2.6" height="12" rx="0.75" fill="none" stroke="currentColor" strokeWidth="1.2" />
                              <rect x="12.4" y="2" width="2.6" height="12" rx="0.75" fill="none" stroke="currentColor" strokeWidth="1.2" />
                            </svg>
                          </div>
                          <span>▦ 4 Kolom (4×4 — Grid Mini)</span>
                        </div>
                        {gridCols === 4 && viewLayout === 'grid' && <Check className="w-4 h-4 text-[#0796A6]" />}
                      </button>

                      <div className="pt-1 border-t border-[#E5EAF0]/80">
                        {/* Masonry Option */}
                        <button
                          id="opt-layout-masonry"
                          type="button"
                          onClick={() => handleSelectLayout('masonry')}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                            viewLayout === 'masonry'
                              ? 'bg-[#E8F7F6] text-[#0796A6]'
                              : 'text-[#64748B] hover:text-[#0B1830] hover:bg-[#F7F9FC]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Layers className="w-4 h-4" />
                            <span>▤ Masonry (Proporsional)</span>
                          </div>
                          {viewLayout === 'masonry' && <Check className="w-4 h-4 text-[#0796A6]" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* Folder Category Navigation (if folders exist) */}
        {availableFolders.length > 0 && (
          <div className="pt-4 pb-1 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedFolderFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                selectedFolderFilter === 'all'
                  ? 'bg-[#0B1830] text-white shadow-xs'
                  : 'bg-[#F7F9FC] text-[#64748B] hover:text-[#0B1830] border border-[#E5EAF0]'
              }`}
            >
              <span>Semua Foto</span>
              <span className="text-[10px] font-mono opacity-80">({activePhotos.length})</span>
            </button>

            {availableFolders.map((folderName) => {
              const count = activePhotos.filter((p) => p.folderName === folderName).length;
              const isActive = selectedFolderFilter === folderName;
              return (
                <button
                  key={folderName}
                  onClick={() => setSelectedFolderFilter(folderName)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[#0796A6] text-white shadow-xs ring-2 ring-[#0796A6]/20'
                      : 'bg-[#E8F7F6] text-[#0796A6] hover:bg-[#d5f3f1] border border-[#0796A6]/20'
                  }`}
                >
                  <span>📁 {folderName}</span>
                  <span className="text-[10px] font-mono opacity-80">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Download Error Banner with Retry */}
        {downloadErrorBanner && (
          <div className="mt-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-3 text-rose-900 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-semibold">{downloadErrorBanner.message}</p>
                <p className="text-[11px] text-rose-700">Pastikan koneksi internet stabil dan master Google Drive dapat diakses.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (downloadErrorBanner.isZip) {
                    handleDownloadAllZip();
                  } else if (downloadErrorBanner.photo) {
                    handleSingleDownload(downloadErrorBanner.photo);
                  } else {
                    setDownloadErrorBanner(null);
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Coba Lagi</span>
              </button>
              <button
                type="button"
                onClick={() => setDownloadErrorBanner(null)}
                className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-100 hover:text-rose-800 transition cursor-pointer"
                title="Tutup Pesan"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ZIP Download Progress Overlay Modal */}
        {isZipping && (
          <div className="fixed inset-0 z-50 bg-[#0B1830]/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E5EAF0] rounded-3xl p-6 sm:p-7 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="w-14 h-14 rounded-2xl bg-[#E8F7F6] text-[#0796A6] flex items-center justify-center mx-auto shadow-inner">
                <FileArchive className="w-7 h-7 animate-bounce" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#0B1830] font-serif">Mengemas Foto Original (ZIP)</h3>
                <p className="text-xs text-[#64748B]">
                  {zipProgress?.currentFileName
                    ? `Mengambil: ${zipProgress.currentFileName}`
                    : 'Menghubungkan ke master Google Drive tanpa kompresi...'}
                </p>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="w-full h-2.5 bg-[#F7F9FC] rounded-full overflow-hidden border border-[#E5EAF0]">
                  <div
                    className="h-full bg-gradient-to-r from-[#0796A6] to-[#1473E6] rounded-full transition-all duration-200"
                    style={{ width: `${zipProgress?.percent || 5}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-mono text-[#64748B]">
                  <span>100% Original File</span>
                  <span className="font-bold text-[#0B1830]">{zipProgress?.percent || 0}%</span>
                </div>
              </div>

              <p className="text-[11px] text-[#64748B] italic">
                Semua file diunduh langsung dalam resolusi dan ukuran asli tanpa kompresi atau penurunan kualitas.
              </p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 8. PHOTO GALLERY GRID RENDERING (Strict 4x6 Portrait / 2:3 Ratio)         */}
        {/* ========================================================================= */}
        {displayedPhotos.length === 0 ? (
          <div className="py-24 text-center space-y-3 bg-[#F7F9FC] rounded-[22px] border border-[#E5EAF0] mt-6">
            <Camera className="w-12 h-12 mx-auto text-[#0796A6]/40" />
            <h3 className="text-base font-bold text-[#0B1830] font-serif">Foto Sedang Dipersiapkan</h3>
            <p className="text-xs text-[#64748B] max-w-sm mx-auto">
              Fotografer sedang memproses dan mengunggah foto ke galeri ini. Silakan refresh halaman beberapa saat lagi.
            </p>
          </div>
        ) : viewLayout === 'masonry' ? (
          /* Masonry Flow (Strict 4x6 Portrait Cards) */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4 pt-6">
            {displayedPhotos.map((photo, idx) => (
              <CustomerPhotoCard4x6
                key={photo.id}
                photo={photo}
                index={idx}
                totalPhotos={displayedPhotos.length}
                qualityMode={qualityMode}
                gridCols={3}
                studio={studio}
                studioNameDisplay={studioNameDisplay}
                onClick={() => setLightboxIndex(idx)}
                onDownload={handleSingleDownload}
                manualRotation={photoRotations[photo.id] || 0}
                onRotate={handleRotatePhoto}
              />
            ))}
          </div>
        ) : gridCols === 1 ? (
          /* Mode 1x1: 1 Kolom Portrait 4x6 (2:3) Tersaji Rapi di Tengah */
          <div className="grid grid-cols-1 gap-6 max-w-sm sm:max-w-md mx-auto pt-6">
            {displayedPhotos.map((photo, idx) => (
              <CustomerPhotoCard4x6
                key={photo.id}
                photo={photo}
                index={idx}
                totalPhotos={displayedPhotos.length}
                qualityMode={qualityMode}
                gridCols={1}
                studio={studio}
                studioNameDisplay={studioNameDisplay}
                onClick={() => setLightboxIndex(idx)}
                onDownload={handleSingleDownload}
                manualRotation={photoRotations[photo.id] || 0}
                onRotate={handleRotatePhoto}
              />
            ))}
          </div>
        ) : (
          /* Mode 2x2, 3x3 (DEFAULT MOBILE), 4x4: Strict 4x6 (2:3 Portrait) Grid */
          <div className={`pt-6 ${
            gridCols === 2 
              ? 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5 md:gap-4' 
              : gridCols === 3 
              ? 'grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 sm:gap-2.5 md:gap-3' 
              : 'grid grid-cols-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1 sm:gap-1.5 md:gap-2'
          }`}>
            {displayedPhotos.map((photo, idx) => (
              <CustomerPhotoCard4x6
                key={photo.id}
                photo={photo}
                index={idx}
                totalPhotos={displayedPhotos.length}
                qualityMode={qualityMode}
                gridCols={gridCols}
                studio={studio}
                studioNameDisplay={studioNameDisplay}
                onClick={() => setLightboxIndex(idx)}
                onDownload={handleSingleDownload}
                manualRotation={photoRotations[photo.id] || 0}
                onRotate={handleRotatePhoto}
              />
            ))}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 10. HELP CARD (Support & Studio Assistance) */}
        {/* ========================================================================= */}
        <div className="mt-14 sm:mt-18 bg-[#F7F9FC] border border-[#E5EAF0] rounded-[20px] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-2xs">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#E8F7F6] text-[#0796A6] flex items-center justify-center shrink-0 border border-[#0796A6]/20">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#0B1830] font-serif">Butuh Bantuan?</h3>
              <p className="text-xs sm:text-sm text-[#64748B] mt-0.5 max-w-xl leading-relaxed">
                Jika mengalami kendala saat mengunduh atau mengakses foto, silakan hubungi studio kami untuk bantuan langsung.
              </p>
            </div>
          </div>

          {studio.whatsappNumber && (
            <a
              href={`https://wa.me/${studio.whatsappNumber}?text=Halo%20${encodeURIComponent(studioNameDisplay)},%20saya%20butuh%20bantuan%20mengenai%20galeri%20${encodeURIComponent(album.eventName)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#0B1830] to-[#0796A6] text-white text-xs sm:text-sm font-semibold hover:opacity-95 transition shadow-sm shrink-0"
            >
              <Phone className="w-4 h-4" />
              <span>Hubungi Studio</span>
            </a>
          )}
        </div>

      </main>

      {/* ========================================================================= */}
      {/* 11. FOOTER (Deep Navy → Dark Teal Gradient) */}
      {/* ========================================================================= */}
      <footer className="mt-16 bg-gradient-to-br from-[#0B1830] via-[#101A35] to-[#073B4C] text-white pt-14 pb-8 px-4 sm:px-8 border-t border-[#0B1830]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10 sm:gap-12 pb-12 border-b border-white/10">
          
          {/* Kolom 1: Studio Info & Tagline & Socials */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              {studioLogoUrl ? (
                <div className="h-9 max-w-[150px] p-1 bg-white rounded-xl flex items-center justify-center shadow-xs">
                  <img
                    src={studioLogoUrl}
                    alt={studioNameDisplay}
                    className="max-h-full max-w-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-xl bg-[#0796A6] text-white flex items-center justify-center shadow-xs">
                  <Camera className="w-4 h-4" />
                </div>
              )}
              <h3 className="font-bold text-white text-base tracking-wide uppercase font-serif">
                {studioNameDisplay}
              </h3>
            </div>
            <p className="text-xs text-[#E8F7F6]/80 leading-relaxed max-w-sm">
              {studio.galleryFooterText || studio.tagline || 'Mengabadikan momen berharga Anda dengan standar estetika tertinggi dan dedikasi penuh.'}
            </p>

            {/* Social Icons */}
            <div className="flex items-center gap-3 pt-2">
              {studio.whatsappNumber && (
                <a
                  href={`https://wa.me/${studio.whatsappNumber}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-[#0796A6] flex items-center justify-center text-white transition"
                  title="WhatsApp"
                >
                  <Phone className="w-4 h-4" />
                </a>
              )}
              {studio.instagram && (
                <a
                  href={`https://instagram.com/${studio.instagram.replace('@', '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-pink-600 flex items-center justify-center text-white transition"
                  title="Instagram"
                >
                  <Instagram className="w-4 h-4" />
                </a>
              )}
              {studio.website && (
                <a
                  href={studio.website}
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-[#0796A6] flex items-center justify-center text-white transition"
                  title="Website"
                >
                  <Globe className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          {/* Kolom 2: Layanan Kami */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[#0796A6] tracking-wider uppercase">
              LAYANAN KAMI
            </h4>
            <ul className="space-y-2 text-xs text-white/80">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0796A6]" />
                <span>Wedding Photography & Cinematography</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0796A6]" />
                <span>Event & Ceremony Documentation</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0796A6]" />
                <span>Studio Portrait & Family Session</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0796A6]" />
                <span>Commercial & Editorial Photography</span>
              </li>
            </ul>
          </div>

          {/* Kolom 3: Kontak (Dynamic From Settings) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[#0796A6] tracking-wider uppercase">
              KONTAK
            </h4>
            <div className="space-y-2.5 text-xs text-white/80">
              {studio.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-[#0796A6] shrink-0 mt-0.5" />
                  <span>{studio.address}</span>
                </div>
              )}
              {studio.whatsappNumber && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#0796A6] shrink-0" />
                  <span>+{studio.whatsappNumber}</span>
                </div>
              )}
              {studio.instagram && (
                <div className="flex items-center gap-2">
                  <Instagram className="w-4 h-4 text-[#0796A6] shrink-0" />
                  <span>{studio.instagram.startsWith('@') ? studio.instagram : `@${studio.instagram}`}</span>
                </div>
              )}
              {studio.website && (
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#0796A6] shrink-0" />
                  <span>{studio.website}</span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Bottom copyright */}
        <div className="max-w-7xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-center text-[11px] text-white/50">
          <div>
            © {new Date().getFullYear()} {studioNameDisplay}. All rights reserved.
          </div>
          <div>
            Powered by GaleriFotoQR Cloud Studio
          </div>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* 9. LIGHTBOX (Premium Fullscreen Modal with Navy Backdrop) */}
      {/* ========================================================================= */}
      {lightboxIndex !== null && activePhotos[lightboxIndex] && (
        <CustomerPhotoLightbox
          photos={activePhotos}
          currentIndex={lightboxIndex}
          galleryId={galleryId}
          qualityMode={qualityMode}
          studio={studio}
          initialRotation={photoRotations[activePhotos[lightboxIndex].id] || 0}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(newIdx) => setLightboxIndex(newIdx)}
          onDownloadPhoto={handleSingleDownload}
        />
      )}

      {/* ========================================================================= */}
      {/* SHARE MODAL (Modern Clean Navy & Teal) */}
      {/* ========================================================================= */}
      {showShareModal && (
        <div 
          onClick={() => setShowShareModal(false)}
          className="fixed inset-0 z-50 bg-[#0B1830]/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#FFFFFF] border border-[#E5EAF0] rounded-[22px] p-6 sm:p-7 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-[#E5EAF0] pb-3.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#E8F7F6] text-[#0796A6] flex items-center justify-center">
                  <Share2 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-[#0B1830] text-base font-serif">Bagikan Galeri Foto</h3>
              </div>
              <button 
                onClick={() => setShowShareModal(false)} 
                className="text-[#64748B] hover:text-[#0B1830] p-1 rounded-lg hover:bg-[#F7F9FC] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <button
                onClick={handleShareWhatsApp}
                className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-sm cursor-pointer"
              >
                <Phone className="w-4 h-4" />
                <span>Bagikan Langsung via WhatsApp</span>
              </button>

              <div className="p-3 rounded-xl bg-[#F7F9FC] border border-[#E5EAF0] flex items-center justify-between gap-2">
                <span className="text-xs text-[#111827] font-mono truncate">{publicShareUrl}</span>
                <button
                  onClick={handleCopyShareLink}
                  className="px-3.5 py-2 rounded-lg bg-[#0B1830] hover:bg-[#101A35] text-white font-semibold text-xs shrink-0 flex items-center gap-1.5 cursor-pointer transition"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

