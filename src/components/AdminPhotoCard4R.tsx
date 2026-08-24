import React, { useState } from 'react';
import { Check, Eye, Trash2, Download, Folder } from 'lucide-react';
import { Photo } from '../types';
import { formatPhotoSize, formatPhotoMeta } from '../services/photoService';

interface AdminPhotoCard4RProps {
  photo: Photo;
  isSelected: boolean;
  onToggleSelect: (photoId: string) => void;
  onPreview: (photo: Photo) => void;
  onDelete: (photoId: string) => void;
  onDownload?: (photo: Photo) => void;
  showFolderBadge?: boolean;
}

export const AdminPhotoCard4R: React.FC<AdminPhotoCard4RProps> = ({
  photo,
  isSelected,
  onToggleSelect,
  onPreview,
  onDelete,
  onDownload,
  showFolderBadge = true,
}) => {
  const [isLandscape, setIsLandscape] = useState<boolean | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setIsLoaded(true);
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setIsLandscape(img.naturalWidth > img.naturalHeight);
    }
  };

  // Determine aspect ratio frame:
  // - Landscape photo: 6:4 -> aspect-[3/2]
  // - Portrait / Square / Initial: 4:6 -> aspect-[2/3]
  const aspectClass = isLandscape === true ? 'aspect-[3/2]' : 'aspect-[2/3]';
  const imgSrc = photo.thumbnailUrl || photo.previewUrl || '';
  const folderLabel = photo.folderPath || photo.subfolder || '';
  const formattedSize = formatPhotoSize(photo.fileSize);
  const metaString = formatPhotoMeta(photo);

  return (
    <div
      onClick={() => onToggleSelect(photo.id)}
      className={`group relative ${aspectClass} w-full rounded-2xl overflow-hidden bg-slate-950 border transition-all duration-300 cursor-pointer select-none shadow-2xs hover:shadow-lg ${
        isSelected
          ? 'border-blue-600 ring-3 ring-blue-500/40'
          : 'border-slate-800 hover:border-blue-400'
      }`}
    >
      {/* 1. Ambient blurred background for aesthetic studio frame */}
      {imgSrc && !imageError && (
        <img
          src={imgSrc}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-25 filter blur-lg scale-125 pointer-events-none"
          referrerPolicy="no-referrer"
        />
      )}

      {/* 2. Full 100% uncropped photo with object-contain */}
      {imgSrc && !imageError ? (
        <div className="w-full h-full relative z-1 flex items-center justify-center">
          <img
            src={imgSrc}
            alt={photo.filename}
            onLoad={handleImageLoad}
            onError={() => setImageError(true)}
            className={`max-w-full max-h-full w-full h-full object-contain transition-transform duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            } group-hover:scale-[1.02]`}
            referrerPolicy="no-referrer"
            loading="lazy"
          />
          {!isLoaded && (
            <div className="absolute inset-0 bg-slate-900/60 animate-pulse flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 p-4 text-center">
          <span className="text-[11px] font-semibold">Foto tidak tersedia</span>
        </div>
      )}

      {/* 3. Top Badges: Selection Checkbox (Left) & Folder Label (Right) */}
      <div className="absolute top-2 left-2 right-2 z-10 flex items-start justify-between gap-1.5 pointer-events-none">
        {/* Selection Checkbox */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(photo.id);
          }}
          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-200 pointer-events-auto cursor-pointer shadow-sm ${
            isSelected
              ? 'bg-blue-600 text-white font-bold scale-105 ring-2 ring-white/50'
              : 'bg-slate-900/80 hover:bg-slate-900 text-transparent hover:text-white border border-white/20'
          }`}
          title={isSelected ? 'Batalkan pilihan' : 'Pilih foto'}
        >
          <Check className="w-3.5 h-3.5" />
        </div>

        {/* Folder Badge if available */}
        {showFolderBadge && folderLabel && (
          <div className="px-2 py-0.5 rounded-md bg-slate-900/85 backdrop-blur-md border border-white/15 text-[10px] text-slate-200 font-medium max-w-[120px] truncate shadow-sm flex items-center gap-1">
            <Folder className="w-2.5 h-2.5 text-blue-400 shrink-0" />
            <span className="truncate">{folderLabel}</span>
          </div>
        )}
      </div>

      {/* 4. Bottom-Right Size Badge (Minimalist, visible by default, fades on hover) */}
      {formattedSize && (
        <div className="absolute bottom-2 right-2 z-10 pointer-events-none transition-opacity duration-200 group-hover:opacity-0">
          <span className="px-1.5 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-xs border border-white/15 text-[10px] font-mono font-medium text-white shadow-xs">
            {formattedSize}
          </span>
        </div>
      )}

      {/* 5. Bottom Hover Overlay: Filename & Action Buttons */}
      <div className="absolute inset-x-0 bottom-0 z-10 p-2.5 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-between gap-2">
        <div className="text-white space-y-0.5 max-w-[60%] truncate">
          <p className="text-[10px] font-mono text-slate-200 truncate font-semibold">
            {photo.filename}
          </p>
          <span className="text-[9px] text-slate-300 font-mono block truncate">
            {metaString || `Format 4R (${isLandscape ? '6:4' : '4:6'})`}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onPreview(photo)}
            className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-slate-900 transition hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
            title="Lihat Pratinjau Foto Penuh 4R"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          {onDownload && (
            <button
              type="button"
              onClick={() => onDownload(photo)}
              className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-800 text-white transition hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
              title="Download Foto Asli"
            >
              <Download className="w-3.5 h-3.5 text-slate-200" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onDelete(photo.id)}
            className="p-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white transition hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
            title="Hapus Foto"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
