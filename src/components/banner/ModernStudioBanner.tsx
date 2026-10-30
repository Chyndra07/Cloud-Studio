import React from 'react';
import { Sparkles, Calendar, User, Camera, Heart, Clock, ShieldCheck } from 'lucide-react';

interface ModernStudioBannerProps {
  albumName: string;
  clientName: string;
  eventDate?: string;
  photoCount: number;
  daysRemaining?: number;
  customBannerUrl?: string | null;
  studioName?: string;
  brandColor?: string;
  instructionText?: string;
  className?: string;
  compact?: boolean; // For preview cards
}

export const ModernStudioBanner: React.FC<ModernStudioBannerProps> = ({
  albumName,
  clientName,
  eventDate,
  photoCount,
  daysRemaining,
  customBannerUrl,
  studioName = 'Studio Foto Profesional',
  brandColor = '#2563eb',
  instructionText,
  className = '',
  compact = false,
}) => {
  const hasCustomBanner = Boolean(customBannerUrl && customBannerUrl.trim() !== '');

  // Default Instruction text
  const defaultInstruction =
    instructionText ||
    'Klik tanda ❤️ pada foto untuk memilih foto favorit Anda, berikan catatan jika perlu (misal: "Edit jerawat", "Cetak 4R"), dan unduh foto beresolusi tinggi langsung ke perangkat Anda.';

  if (compact) {
    // Compact version for Preview cards in Branding Settings
    return (
      <div
        className={`w-full rounded-2xl overflow-hidden border border-slate-200 shadow-md relative bg-gradient-to-r from-sky-100 via-blue-50/90 to-white text-slate-900 ${className}`}
        style={{ minHeight: '140px' }}
      >
        {hasCustomBanner ? (
          <div className="absolute inset-0 z-0">
            <img
              src={customBannerUrl!}
              alt="Custom Banner"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-900/60 to-transparent" />
          </div>
        ) : (
          /* Default Studio Banner Graphic in Compact */
          <div className="absolute right-0 top-0 bottom-0 w-1/2 overflow-hidden pointer-events-none z-0">
            <img
              src="./banner-camera.jpg"
              alt="Professional Camera"
              className="w-full h-full object-cover object-right opacity-90 mix-blend-multiply"
              onError={(e) => {
                // Fallback to camera icon if image fails to load
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-50 via-blue-50/50 to-transparent" />
          </div>
        )}

        <div className={`relative z-10 p-4 flex flex-col justify-between h-full ${hasCustomBanner ? 'text-white' : 'text-slate-900'}`}>
          <div className="space-y-1">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                hasCustomBanner ? 'bg-white/20 text-white backdrop-blur-xs' : 'bg-blue-600 text-white'
              }`}
            >
              <Sparkles className="w-2.5 h-2.5" /> Galeri Foto Digital
            </span>
            <h4 className="text-sm font-black tracking-tight truncate max-w-[240px]">
              {albumName || 'Nama Album Pelanggan'}
            </h4>
            <div className={`flex items-center gap-2 text-[10px] ${hasCustomBanner ? 'text-slate-200' : 'text-slate-600'}`}>
              <span>👤 {clientName || 'Nama Klien'}</span>
              <span>📸 {photoCount || 0} Foto</span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <span className={`text-[9px] font-bold tracking-widest uppercase opacity-75 ${hasCustomBanner ? 'text-blue-300' : 'text-blue-900'}`}>
              Your Story, Our Lens
            </span>
            <span className="text-[8px] font-mono opacity-60">16:5 Landscape</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full rounded-3xl overflow-hidden border border-slate-200/90 shadow-xl transition-all duration-300 ${
        hasCustomBanner
          ? 'bg-slate-950 text-white'
          : 'bg-gradient-to-r from-sky-100 via-sky-50/80 to-white text-slate-900'
      } ${className}`}
      style={{ aspectRatio: '16 / 5', minHeight: '260px' }}
    >
      {/* ------------------------------------------------------------- */}
      {/* BACKGROUND LAYER                                              */}
      {/* ------------------------------------------------------------- */}
      {hasCustomBanner ? (
        /* 1. Custom User Banner Background */
        <div className="absolute inset-0 z-0">
          <img
            src={customBannerUrl!}
            alt="Studio Banner"
            className="w-full h-full object-cover"
          />
          {/* Subtle multi-stop gradient for perfect text contrast on left */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/75 to-slate-950/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
        </div>
      ) : (
        /* 2. Default Modern Photography Studio Banner Background */
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          {/* Subtle Geometry & Photography Iris Elements */}
          <div className="absolute -left-20 -top-20 w-80 h-80 rounded-full bg-blue-300/20 blur-3xl pointer-events-none" />
          <div className="absolute left-1/3 top-1/4 w-96 h-96 rounded-full bg-sky-200/30 blur-2xl pointer-events-none" />

          {/* Aperture Grid lines accent */}
          <svg
            className="absolute right-0 top-0 bottom-0 h-full w-auto text-blue-900/5 pointer-events-none"
            viewBox="0 0 400 300"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          >
            <circle cx="280" cy="150" r="120" strokeDasharray="4 6" />
            <circle cx="280" cy="150" r="90" />
            <circle cx="280" cy="150" r="60" strokeDasharray="2 4" />
            <line x1="280" y1="10" x2="280" y2="290" strokeDasharray="3 3" />
            <line x1="140" y1="150" x2="420" y2="150" strokeDasharray="3 3" />
          </svg>

          {/* RIGHT SIDE: Real Professional DSLR Camera Visual */}
          <div className="absolute right-0 top-0 bottom-0 w-full sm:w-2/3 lg:w-1/2 flex items-center justify-end overflow-hidden">
            <img
              src="./banner-camera.jpg"
              alt="Professional Studio Camera"
              className="h-full w-auto max-w-none object-cover object-right opacity-90 sm:opacity-95 mix-blend-multiply transition-transform duration-700 hover:scale-105"
              onError={(e) => {
                // If local jpg is loading, keep elegant fallback
                (e.target as HTMLElement).style.opacity = '0.3';
              }}
            />
            {/* Smooth leftward fade gradient so camera blends seamlessly with light blue background */}
            <div className="absolute inset-0 bg-gradient-to-r from-sky-100 via-sky-50/70 sm:via-transparent to-transparent" />
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* CONTENT GRID (LEFT: DYNAMIC ALBUM INFO, RIGHT: STUDIO TAGLINE) */}
      {/* ------------------------------------------------------------- */}
      <div className="relative z-10 h-full w-full p-6 sm:p-8 lg:p-10 flex flex-col justify-between">
        {/* TOP ROW: Badge & Studio Subtitle */}
        <div className="flex items-start justify-between gap-4">
          {/* Left Badge: GALERI FOTO DIGITAL */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider shadow-xs ${
                hasCustomBanner
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-600 text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>GALERI FOTO DIGITAL</span>
            </span>

            {daysRemaining !== undefined && daysRemaining !== null && (
              <span
                className={`hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                  daysRemaining <= 3
                    ? 'bg-rose-500/15 text-rose-700 border border-rose-300'
                    : hasCustomBanner
                    ? 'bg-white/10 text-white/90 border border-white/20'
                    : 'bg-white/80 text-blue-900 border border-blue-200 shadow-2xs'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>Masa Aktif: {daysRemaining} Hari</span>
              </span>
            )}
          </div>

          {/* Right Subtitle: PROFESSIONAL PHOTOGRAPHY STUDIO */}
          <div className="hidden md:flex flex-col items-end text-right">
            <span
              className={`text-[10px] lg:text-[11px] font-black uppercase tracking-widest ${
                hasCustomBanner ? 'text-blue-300' : 'text-blue-700'
              }`}
            >
              PROFESSIONAL PHOTOGRAPHY STUDIO
            </span>
            <span
              className={`text-xs font-serif italic font-medium tracking-wide ${
                hasCustomBanner ? 'text-white/80' : 'text-slate-600'
              }`}
            >
              Your Story, Our Lens
            </span>
          </div>
        </div>

        {/* MIDDLE: ALBUM TITLE & CLIENT METADATA */}
        <div className="my-auto py-3 space-y-2.5 max-w-2xl">
          <h2
            className={`text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-tight ${
              hasCustomBanner ? 'text-white' : 'text-slate-900 font-sans'
            }`}
          >
            {albumName}
          </h2>

          <div
            className={`flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm font-semibold ${
              hasCustomBanner ? 'text-slate-200' : 'text-slate-700'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span>Pelanggan: <strong className={hasCustomBanner ? 'text-white' : 'text-slate-900'}>{clientName}</strong></span>
            </span>

            {eventDate && (
              <>
                <span className="opacity-40">•</span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>Acara: <strong className={hasCustomBanner ? 'text-white' : 'text-slate-900'}>{eventDate}</strong></span>
                </span>
              </>
            )}

            <span className="opacity-40">•</span>
            <span className="flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-blue-600" />
              <span><strong className={hasCustomBanner ? 'text-white' : 'text-slate-900'}>{photoCount} Foto Asli</strong></span>
            </span>

            {daysRemaining !== undefined && daysRemaining !== null && (
              <span className="sm:hidden text-xs text-blue-700 font-bold">
                ⏳ {daysRemaining} Hari
              </span>
            )}
          </div>

          {/* Instruction Text */}
          <p
            className={`text-xs sm:text-sm leading-relaxed max-w-xl line-clamp-2 sm:line-clamp-none ${
              hasCustomBanner ? 'text-slate-300' : 'text-slate-600'
            }`}
          >
            {defaultInstruction}
          </p>
        </div>

        {/* BOTTOM: Subtext & Studio Sign-off on Mobile */}
        <div className="pt-2 flex items-center justify-between border-t border-black/5 dark:border-white/10 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-current" />
            <span>Pilih foto favorit untuk cetak album atau retouch eksklusif</span>
          </div>

          <div className="md:hidden text-[10px] font-bold tracking-wider uppercase text-blue-700 dark:text-blue-300">
            Your Story, Our Lens
          </div>
        </div>
      </div>
    </div>
  );
};
