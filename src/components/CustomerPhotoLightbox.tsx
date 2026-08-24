import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  RefreshCw, 
  AlertCircle,
  Zap,
  Sparkles,
  Maximize2,
  RotateCw
} from 'lucide-react';
import { Photo, StudioProfile } from '../types';
import { 
  getPublicPhotoUrl, 
  resolveDirectPhotoUrl, 
  preloadImage,
  formatPhotoSize,
  formatPhotoDimensions,
  formatPhotoMeta
} from '../services/photoService';

interface CustomerPhotoLightboxProps {
  photos: Photo[];
  currentIndex: number;
  galleryId: string;
  qualityMode: 'light' | 'hd';
  studio: StudioProfile;
  initialRotation?: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onDownloadPhoto: (photo: Photo) => void;
}

export const CustomerPhotoLightbox: React.FC<CustomerPhotoLightboxProps> = ({
  photos,
  currentIndex,
  galleryId,
  qualityMode,
  studio,
  initialRotation = 0,
  onClose,
  onNavigate,
  onDownloadPhoto,
}) => {
  const currentPhoto = photos[currentIndex];

  const [isLoadingHd, setIsLoadingHd] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [activeSrc, setActiveSrc] = useState<string>('');
  const [rotationDegrees, setRotationDegrees] = useState<number>(initialRotation);
  const [detectedDimensions, setDetectedDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadClick = async () => {
    if (!currentPhoto || isDownloading) return;
    setIsDownloading(true);
    try {
      await onDownloadPhoto(currentPhoto);
    } finally {
      setIsDownloading(false);
    }
  };

  // Update rotation and reset detected dimensions when navigating photos
  useEffect(() => {
    setRotationDegrees(initialRotation || 0);
    setDetectedDimensions(null);
  }, [currentIndex, initialRotation]);

  // Touch swipe support for mobile
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  // Determine current image URLs
  const thumbUrl = currentPhoto
    ? getPublicPhotoUrl(currentPhoto, 'thumb', galleryId)
    : '';

  const highResUrl = currentPhoto
    ? getPublicPhotoUrl(
        currentPhoto,
        qualityMode === 'hd' ? 'hd' : 'preview',
        galleryId
      )
    : '';

  // Fallback direct URL if backend proxy fails
  const directFallbackUrl = currentPhoto
    ? resolveDirectPhotoUrl(
        currentPhoto,
        qualityMode === 'hd' ? 'hd' : 'preview'
      )
    : '';

  // 1. Load active photo with intelligent preload & fallback
  useEffect(() => {
    if (!currentPhoto) return;

    let isMounted = true;
    setIsLoadingHd(true);
    setHasError(false);
    setErrorMessage('');

    // Strategy: First try the primary highResUrl
    const candidateUrl = retryCount > 0 ? directFallbackUrl : highResUrl;

    console.log(`[Lightbox] Loading photo index ${currentIndex + 1}/${photos.length}: "${currentPhoto.filename}" (Mode: ${qualityMode}, Attempt: ${retryCount + 1})`);

    preloadImage(candidateUrl)
      .then((img) => {
        if (!isMounted) return;
        setActiveSrc(img.src);
        if (img.naturalWidth && img.naturalHeight) {
          setDetectedDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        }
        setIsLoadingHd(false);
        setHasError(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn(`[Lightbox Preload Failed] Primary candidate failed for "${currentPhoto.filename}". Trying direct fallback...`, {
          photoId: currentPhoto.id,
          driveFileId: currentPhoto.driveFileId,
          requestedQuality: qualityMode,
          candidateUrl,
        });

        // Try direct fallback URL if not already tried
        if (directFallbackUrl && candidateUrl !== directFallbackUrl) {
          preloadImage(directFallbackUrl)
            .then((img) => {
              if (!isMounted) return;
              setActiveSrc(img.src);
              if (img.naturalWidth && img.naturalHeight) {
                setDetectedDimensions({ width: img.naturalWidth, height: img.naturalHeight });
              }
              setIsLoadingHd(false);
              setHasError(false);
            })
            .catch((fallbackErr) => {
              if (!isMounted) return;
              // If high-res fallback fails, try thumbnail as last visual resort
              if (thumbUrl && directFallbackUrl !== thumbUrl) {
                preloadImage(thumbUrl)
                  .then((img) => {
                    if (!isMounted) return;
                    setActiveSrc(img.src);
                    if (img.naturalWidth && img.naturalHeight) {
                      setDetectedDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                    }
                    setIsLoadingHd(false);
                    setHasError(false);
                  })
                  .catch(() => {
                    if (!isMounted) return;
                    setIsLoadingHd(false);
                    setHasError(true);
                    setErrorMessage('Foto tidak dapat dimuat dari Google Drive.');
                  });
              } else {
                setIsLoadingHd(false);
                setHasError(true);
                setErrorMessage('Foto tidak dapat dimuat dari Google Drive.');
              }
            });
        } else {
          setIsLoadingHd(false);
          setHasError(true);
          setErrorMessage('Foto tidak dapat dimuat dari Google Drive.');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentIndex, currentPhoto, retryCount, qualityMode, galleryId]);

  // 2. Preload Previous and Next Photos in Background for Instant Navigation
  useEffect(() => {
    if (!photos || photos.length === 0) return;

    // Preload Next
    if (currentIndex < photos.length - 1) {
      const nextPhoto = photos[currentIndex + 1];
      const nextUrl = getPublicPhotoUrl(
        nextPhoto,
        qualityMode === 'hd' ? 'hd' : 'preview',
        galleryId
      );
      preloadImage(nextUrl).catch(() => {});
    }

    // Preload Previous
    if (currentIndex > 0) {
      const prevPhoto = photos[currentIndex - 1];
      const prevUrl = getPublicPhotoUrl(
        prevPhoto,
        qualityMode === 'hd' ? 'hd' : 'preview',
        galleryId
      );
      preloadImage(prevUrl).catch(() => {});
    }
  }, [currentIndex, photos, qualityMode, galleryId]);

  // 3. Keyboard Navigation Handling
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        if (currentIndex > 0) {
          onNavigate(currentIndex - 1);
        }
      } else if (e.key === 'ArrowRight') {
        if (currentIndex < photos.length - 1) {
          onNavigate(currentIndex + 1);
        }
      }
    },
    [currentIndex, photos.length, onClose, onNavigate]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // 4. Touch Gestures (Swipe Left / Swipe Right) for Mobile Devices
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const diffX = touchStartXRef.current - touchEndX;
    const diffY = touchStartYRef.current - touchEndY;

    // Reset touch refs
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    // Check if horizontal swipe is prominent (ignore vertical scrolling gestures)
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 45) {
      if (diffX > 0) {
        // Swiped Left -> Next
        if (currentIndex < photos.length - 1) {
          onNavigate(currentIndex + 1);
        }
      } else {
        // Swiped Right -> Previous
        if (currentIndex > 0) {
          onNavigate(currentIndex - 1);
        }
      }
    }
  };

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
  };

  if (!currentPhoto) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Pratinjau Foto ${currentIndex + 1} dari ${photos.length}`}
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 z-50 bg-[#0B1830]/95 backdrop-blur-md flex flex-col justify-between select-none animate-in fade-in duration-200"
    >
      {/* Top Header Controls Bar */}
      <header
        className="w-full flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 z-20 bg-gradient-to-b from-[#0B1830]/90 to-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Photo Counter & Quality Badge */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="px-3.5 py-1 rounded-full bg-[#101A35]/90 border border-[#E5EAF0]/20 text-[#E8F7F6] font-mono text-xs font-semibold shadow-xs">
            {currentIndex + 1} / {photos.length}
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#101A35]/70 border border-[#E5EAF0]/20 text-[11px] text-[#E8F7F6]/80">
            {qualityMode === 'hd' ? (
              <>
                <Sparkles className="w-3.5 h-3.5 text-[#0796A6]" />
                <span className="font-semibold text-white">Mode HD Asli</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-[#0796A6]" />
                <span>Mode Ringan</span>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Rotate Button */}
          <button
            id="btn-lightbox-rotate"
            type="button"
            onClick={() => setRotationDegrees((prev) => (prev + 90) % 360)}
            className="p-2 rounded-xl bg-[#101A35]/80 border border-[#E5EAF0]/20 text-white/90 hover:text-white hover:bg-[#101A35] transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            title="Putar Tampilan Foto (90°)"
          >
            <RotateCw className="w-4 h-4 text-[#0796A6]" />
            <span className="hidden sm:inline">Putar 90°</span>
          </button>

          {studio.allowClientDownload !== false && (
            <button
              onClick={handleDownloadClick}
              disabled={isDownloading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#0796A6] to-[#1473E6] text-white font-semibold text-xs hover:opacity-95 transition shadow-md active:scale-95 cursor-pointer disabled:opacity-75"
              title="Download Foto Resolusi Penuh Original"
            >
              {isDownloading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4 text-white" />
              )}
              <span className="hidden sm:inline">{isDownloading ? 'Mengunduh...' : 'Download Foto'}</span>
              <span className="sm:hidden">{isDownloading ? '...' : 'Download'}</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-[#101A35]/80 border border-[#E5EAF0]/20 text-white/80 hover:text-white hover:bg-[#101A35] transition cursor-pointer"
            aria-label="Tutup Preview"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Image Stage & Navigation Area */}
      <main
        className="relative flex-1 w-full flex items-center justify-center overflow-hidden px-2 sm:px-12 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Previous Button (Desktop) */}
        {currentIndex > 0 && (
          <button
            onClick={() => onNavigate(currentIndex - 1)}
            className="absolute left-2 sm:left-6 z-30 p-3 sm:p-3.5 rounded-full bg-[#101A35]/80 border border-[#E5EAF0]/20 text-white hover:bg-[#101A35] hover:scale-105 transition shadow-xl active:scale-95 cursor-pointer"
            aria-label="Foto Sebelumnya"
            title="Foto Sebelumnya (←)"
          >
            <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
        )}

        {/* Image Container with Aspect Ratio Preservation */}
        <div className="relative max-w-full max-h-[calc(100vh-140px)] flex items-center justify-center">
          {/* 1. Low-Res Placeholder (Rendered immediately while HD loads to eliminate black screen) */}
          {isLoadingHd && thumbUrl && (
            <img
              src={thumbUrl}
              alt=""
              aria-hidden="true"
              className="max-w-full max-h-[calc(100vh-140px)] object-contain rounded-xl blur-xs opacity-60 transition-opacity duration-300"
              style={{
                transform: rotationDegrees ? `rotate(${rotationDegrees}deg)` : undefined,
                transition: 'transform 0.3s ease',
              }}
              referrerPolicy="no-referrer"
            />
          )}

          {/* 2. Full High-Res Photo (Rendered once activeSrc is resolved) */}
          {!hasError && activeSrc && (
            <img
              src={activeSrc}
              alt={currentPhoto.filename}
              className={`max-w-full max-h-[calc(100vh-140px)] object-contain mx-auto rounded-xl shadow-2xl transition-all duration-300 ${
                isLoadingHd ? 'opacity-0 absolute' : 'opacity-100'
              }`}
              style={{
                transform: rotationDegrees ? `rotate(${rotationDegrees}deg)` : undefined,
                maxHeight: rotationDegrees % 180 !== 0 ? 'calc(90vw - 80px)' : 'calc(100vh - 140px)',
                maxWidth: rotationDegrees % 180 !== 0 ? 'calc(90vh - 140px)' : '100%',
              }}
              referrerPolicy="no-referrer"
            />
          )}

          {/* 3. Studio Watermark on Fullscreen if enabled */}
          {!hasError && studio.watermarkEnabled && !isLoadingHd && (
            <div
              className={`absolute pointer-events-none p-3 ${
                studio.watermarkPosition === 'bottom-left' ? 'bottom-2 left-2' :
                studio.watermarkPosition === 'center' ? 'inset-0 flex items-center justify-center' :
                studio.watermarkPosition === 'top-right' ? 'top-2 right-2' :
                'bottom-2 right-2'
              }`}
            >
              <span className="text-[10px] sm:text-xs font-bold tracking-wider text-[#0B1830] bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-md shadow-md border border-[#E5EAF0]">
                {studio.watermarkText || studio.studioName}
              </span>
            </div>
          )}

          {/* 4. Loading Spinner Indicator */}
          {isLoadingHd && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
              <div className="p-3.5 rounded-2xl bg-[#0B1830]/90 border border-[#E5EAF0]/20 shadow-2xl flex items-center gap-2.5 text-white">
                <RefreshCw className="w-5 h-5 animate-spin text-[#0796A6]" />
                <span className="text-xs font-semibold">Memuat foto...</span>
              </div>
            </div>
          )}

          {/* 5. Error State with Retry Button */}
          {hasError && (
            <div className="p-8 rounded-2xl bg-[#101A35] border border-[#E5EAF0]/20 text-center space-y-4 max-w-sm shadow-2xl">
              <div className="w-12 h-12 mx-auto rounded-xl bg-rose-950/80 border border-rose-800/60 text-rose-400 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Foto tidak dapat dimuat</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {errorMessage || 'Kendala jaringan atau izin akses Google Drive saat memproses foto ini.'}
                </p>
              </div>

              <div className="pt-2 flex items-center justify-center gap-2">
                <button
                  onClick={handleRetry}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#0796A6] to-[#1473E6] text-white font-bold text-xs transition flex items-center gap-1.5 shadow cursor-pointer active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Coba Lagi</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Next Button (Desktop) */}
        {currentIndex < photos.length - 1 && (
          <button
            onClick={() => onNavigate(currentIndex + 1)}
            className="absolute right-2 sm:right-6 z-30 p-3 sm:p-3.5 rounded-full bg-[#101A35]/80 border border-[#E5EAF0]/20 text-white hover:bg-[#101A35] hover:scale-105 transition shadow-xl active:scale-95 cursor-pointer"
            aria-label="Foto Berikutnya"
            title="Foto Berikutnya (→)"
          >
            <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
        )}
      </main>

      {/* Bottom Info & Mobile Navigation Helper Bar */}
      <footer
        className="w-full px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-2 z-20 bg-gradient-to-t from-[#0B1830]/90 via-[#0B1830]/60 to-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#E8F7F6]/90 font-mono max-w-full sm:max-w-xl">
          <span className="font-semibold text-white truncate max-w-[180px] sm:max-w-xs">{currentPhoto.filename}</span>
          {(() => {
            const sizeStr = formatPhotoSize(currentPhoto.fileSize);
            const dimStr = currentPhoto.width && currentPhoto.height 
              ? `${currentPhoto.width} × ${currentPhoto.height} px`
              : detectedDimensions 
              ? `${detectedDimensions.width} × ${detectedDimensions.height} px`
              : undefined;
            
            const combined = [sizeStr, dimStr].filter(Boolean).join(' • ');
            if (!combined) return null;

            return (
              <span className="px-2.5 py-0.5 rounded-md bg-[#101A35]/90 border border-[#E5EAF0]/20 text-[#E8F7F6] text-[11px] font-mono shadow-xs">
                {combined}
              </span>
            );
          })()}
          {currentPhoto.folderPath && (
            <span className="px-2 py-0.5 rounded-md bg-[#101A35]/70 border border-[#E5EAF0]/10 text-white/60 text-[11px] font-mono hidden md:inline">
              📁 {currentPhoto.folderPath}
            </span>
          )}
        </div>

        {/* Mobile Navigation Thumb Controls & Hints */}
        <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3">
          <div className="flex items-center gap-1.5 sm:hidden">
            <button
              disabled={currentIndex <= 0}
              onClick={() => onNavigate(currentIndex - 1)}
              className="px-3 py-1.5 rounded-lg bg-[#101A35]/90 border border-[#E5EAF0]/20 text-white text-xs disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Prev</span>
            </button>
            <button
              disabled={currentIndex >= photos.length - 1}
              onClick={() => onNavigate(currentIndex + 1)}
              className="px-3 py-1.5 rounded-lg bg-[#101A35]/90 border border-[#E5EAF0]/20 text-white text-xs disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-white/60">
            <span className="hidden md:inline">Gunakan tombol panah <strong>←</strong> / <strong>→</strong> pada keyboard</span>
            <span className="text-white/50 text-[10px] sm:text-xs">Swipe kiri/kanan</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
