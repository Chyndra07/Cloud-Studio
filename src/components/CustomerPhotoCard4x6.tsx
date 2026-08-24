import React, { useState } from 'react';
import { Maximize2, Download, RotateCw } from 'lucide-react';
import { Photo, StudioProfile } from '../types';
import { formatPhotoSize, formatPhotoMeta } from '../services/photoService';

interface CustomerPhotoCard4x6Props {
  photo: Photo;
  index: number;
  totalPhotos: number;
  qualityMode: 'hd' | 'light';
  gridCols: 1 | 2 | 3 | 4;
  studio: StudioProfile;
  studioNameDisplay: string;
  onClick: () => void;
  onDownload: (photo: Photo) => void;
  manualRotation?: number;
  onRotate?: (photoId: string, newRotation: number) => void;
}

export const CustomerPhotoCard4x6: React.FC<CustomerPhotoCard4x6Props> = ({
  photo,
  index,
  totalPhotos,
  qualityMode,
  gridCols,
  studio,
  studioNameDisplay,
  onClick,
  onDownload,
  manualRotation = 0,
  onRotate,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [naturalAspect, setNaturalAspect] = useState<'portrait' | 'landscape' | null>(null);

  const imgSrc =
    qualityMode === 'hd' && gridCols <= 2
      ? photo.previewUrl || photo.thumbnailUrl
      : photo.thumbnailUrl;

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setIsLoaded(true);
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      if (img.naturalWidth > img.naturalHeight) {
        setNaturalAspect('landscape');
      } else {
        setNaturalAspect('portrait');
      }
    }
  };

  const handleManualRotateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextRotation = (manualRotation + 90) % 360;
    if (onRotate) {
      onRotate(photo.id, nextRotation);
    }
  };

  // Determine effective rotation
  const effectiveRotation = manualRotation % 360;
  const isRotatedQuarter = effectiveRotation === 90 || effectiveRotation === 270;
  const formattedSize = formatPhotoSize(photo.fileSize);
  const metaString = formatPhotoMeta(photo);

  return (
    <div
      id={`photo-card-${photo.id}`}
      onClick={onClick}
      className={`group relative aspect-[2/3] w-full overflow-hidden bg-[#F1F5F9] border border-[#E5EAF0] hover:border-[#0796A6]/50 transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-md select-none ${
        gridCols === 1
          ? 'rounded-[16px] sm:rounded-[22px]'
          : gridCols === 2
          ? 'rounded-[10px] sm:rounded-[14px]'
          : gridCols === 3
          ? 'rounded-[6px] sm:rounded-[10px] md:rounded-[12px]'
          : 'rounded-[4px] sm:rounded-[8px]'
      }`}
    >
      {/* Photo Image with 4x6 Portrait Constraint & Scale-Compensated Rotation */}
      <div className="w-full h-full relative overflow-hidden flex items-center justify-center">
        <img
          src={imgSrc}
          alt={photo.filename}
          onLoad={handleImageLoad}
          className={`w-full h-full object-cover object-center transition-transform duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${!isRotatedQuarter ? 'group-hover:scale-105' : ''}`}
          style={{
            transform: isRotatedQuarter
              ? `rotate(${effectiveRotation}deg) scale(1.5)`
              : effectiveRotation !== 0
              ? `rotate(${effectiveRotation}deg)`
              : undefined,
            transformOrigin: 'center center',
          }}
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
        />

        {/* Placeholder shimmer before load */}
        {!isLoaded && (
          <div className="absolute inset-0 bg-[#E5EAF0]/60 animate-pulse" />
        )}
      </div>

      {/* Top Right Maximize Icon on Hover (For 1 & 2 Col) */}
      {gridCols <= 2 && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 z-10">
          <button
            type="button"
            onClick={handleManualRotateClick}
            className="p-1.5 rounded-lg bg-[#FFFFFF]/90 hover:bg-[#FFFFFF] backdrop-blur-xs text-[#0B1830] shadow-xs hover:scale-105 transition cursor-pointer"
            title="Putar Foto 90°"
          >
            <RotateCw className="w-3 h-3 text-[#0796A6]" />
          </button>
          <div className="p-1.5 rounded-lg bg-[#FFFFFF]/90 backdrop-blur-xs text-[#0B1830] shadow-xs">
            <Maximize2 className="w-3 h-3" />
          </div>
        </div>
      )}

      {/* Studio Watermark Overlay if enabled */}
      {studio.watermarkEnabled && (
        <div
          className={`absolute pointer-events-none z-10 ${
            gridCols <= 2
              ? 'bottom-2 left-2 p-0'
              : 'bottom-1 left-1 p-0'
          }`}
        >
          <span
            className={`font-bold tracking-wider text-[#0B1830] bg-white/90 px-1 py-0.2 rounded border border-[#E5EAF0] shadow-2xs ${
              gridCols <= 2 ? 'text-[8px] sm:text-[9px]' : 'text-[6px] sm:text-[7px]'
            }`}
          >
            {studio.watermarkText || studioNameDisplay}
          </span>
        </div>
      )}

      {/* Center hover indicator for 3 & 4 Col */}
      {gridCols >= 3 && (
        <div className="absolute inset-0 bg-[#0B1830]/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none z-10">
          <div className="p-1.5 sm:p-2 rounded-full bg-white/90 text-[#0B1830] shadow-sm transform scale-90 group-hover:scale-100 transition-transform">
            <Maximize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </div>
        </div>
      )}

      {/* Bottom Right File Size Badge (always visible on thumbnail, bottom-right) */}
      {formattedSize && (
        <div
          className={`absolute pointer-events-none z-10 transition-opacity duration-200 ${
            gridCols <= 2 ? 'group-hover:opacity-0' : ''
          } ${
            gridCols === 1
              ? 'bottom-3.5 right-3.5'
              : gridCols === 2
              ? 'bottom-2 right-2'
              : 'bottom-1.5 right-1.5'
          }`}
        >
          <span
            className={`font-mono font-semibold text-white bg-slate-950/80 backdrop-blur-xs rounded border border-white/15 shadow-xs ${
              gridCols === 1
                ? 'text-[11px] px-2 py-0.5'
                : gridCols === 2
                ? 'text-[9px] sm:text-[10px] px-1.5 py-0.5'
                : 'text-[7.5px] sm:text-[8.5px] px-1 py-0.2'
            }`}
          >
            {formattedSize}
          </span>
        </div>
      )}

      {/* Bottom Info Bar for 1-Column Mode */}
      {gridCols === 1 && (
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[#0B1830]/95 via-[#0B1830]/65 to-transparent p-3.5 sm:p-4 flex items-center justify-between text-white transition-opacity duration-200">
          <div className="space-y-0.5 max-w-[70%] truncate">
            <span className="text-[10px] font-mono text-[#E8F7F6] block font-bold">
              Foto {index + 1} dari {totalPhotos} {metaString ? `• ${metaString}` : ''}
            </span>
            <span className="text-xs sm:text-sm text-white/95 font-semibold truncate block">
              {photo.filename}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleManualRotateClick}
              className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs transition cursor-pointer"
              title="Putar Foto 90°"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            {studio.allowClientDownload !== false && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload(photo);
                }}
                className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-white text-[#0B1830] hover:bg-[#E8F7F6] hover:text-[#0796A6] font-bold text-xs transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                title="Download Foto Asli"
              >
                <Download className="w-3.5 h-3.5 text-[#0796A6]" />
                <span>Download</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bottom overlay for 2-Column Mode on hover */}
      {gridCols === 2 && (
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[#0B1830]/95 via-[#0B1830]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-between p-2.5 sm:p-3">
          <div className="text-white space-y-0.5 max-w-[140px] truncate">
            <span className="text-[9px] font-mono text-[#E8F7F6] block font-bold truncate">
              {metaString || `${index + 1} / ${totalPhotos}`}
            </span>
            <span className="text-[11px] text-white/90 font-medium truncate block">
              {photo.filename}
            </span>
          </div>

          {studio.allowClientDownload !== false && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDownload(photo);
              }}
              className="p-1.5 sm:p-2 rounded-lg bg-white text-[#0B1830] hover:bg-[#E8F7F6] hover:text-[#0796A6] font-bold transition shadow-sm hover:scale-105 cursor-pointer"
              title="Download Foto Asli"
            >
              <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
