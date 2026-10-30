import React, { useState } from 'react';
import {
  Folder,
  MoreVertical,
  Edit2,
  Trash2,
  FolderTree,
  ChevronRight,
  Clock,
  Image as ImageIcon,
} from 'lucide-react';
import { AlbumFolder } from '../../types';

interface FolderCardProps {
  folder: AlbumFolder;
  onOpen: (folder: AlbumFolder) => void;
  onRename: (folder: AlbumFolder) => void;
  onDelete: (folder: AlbumFolder) => void;
  onMove?: (folder: AlbumFolder) => void;
  onDropPhoto?: (photoId: string, targetFolderId: string) => void;
}

export const FolderCard: React.FC<FolderCardProps> = ({
  folder,
  onOpen,
  onRename,
  onDelete,
  onMove,
  onDropPhoto,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const photoId = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('photoId');
    if (photoId && onDropPhoto) {
      onDropPhoto(photoId, folder.id);
    }
  };

  const formattedDate = folder.createdAt
    ? new Date(folder.createdAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => onOpen(folder)}
      className={`relative bg-white border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between ${
        isDragOver
          ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/30 scale-[1.02]'
          : 'border-slate-200 hover:border-blue-300'
      }`}
    >
      {/* Top Bar: Folder Icon, Name & Menu Button */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 shadow-xs border border-amber-200/60 group-hover:scale-105 transition-transform">
            <Folder className="w-6 h-6 fill-amber-500/20 text-amber-600" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors" title={folder.name}>
              {folder.name}
            </h4>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
              <ImageIcon className="w-3 h-3" />
              <span>{folder.photoCount ?? 0} foto</span>
            </div>
          </div>
        </div>

        {/* Dropdown Menu Button */}
        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all opacity-80 group-hover:opacity-100"
            title="Opsi Folder"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {isMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setIsMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 py-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onRename(folder);
                  }}
                  className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Edit2 className="w-3.5 h-3.5 text-amber-500" />
                  <span>Ubah Nama Folder</span>
                </button>

                {onMove && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onMove(folder);
                    }}
                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <FolderTree className="w-3.5 h-3.5 text-blue-500" />
                    <span>Pindahkan Folder</span>
                  </button>
                )}

                <div className="my-1 border-t border-slate-100" />

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onDelete(folder);
                  }}
                  className="w-full px-3.5 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Folder</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Bar: Date & Open indicator */}
      <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-300" />
          {formattedDate || 'Folder'}
        </span>
        <span className="text-blue-600 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
          Buka
          <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
};
