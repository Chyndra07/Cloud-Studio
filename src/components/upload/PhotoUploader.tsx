import React, { useState, useRef } from 'react';
import { Upload, FolderUp, Image as ImageIcon, CheckCircle, AlertCircle, RefreshCw, X } from 'lucide-react';
import { PhotoItem } from '../../types';
import { uploadOriginalPhoto } from '../../services/googleDriveService';

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'queued' | 'uploading' | 'completed' | 'error';
  errorMessage?: string;
  photoResult?: PhotoItem;
}

interface PhotoUploaderProps {
  accessToken: string;
  driveFolderId: string;
  onPhotosUploaded: (newPhotos: PhotoItem[]) => void;
  onClose?: () => void;
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  accessToken,
  driveFolderId,
  onPhotosUploaded,
  onClose,
}) => {
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    // Filter only images
    const validFiles: UploadItem[] = Array.from(fileList)
      .filter((f) => f.type.startsWith('image/'))
      .map((file) => ({
        id: `${file.name}_${file.size}_${Date.now()}_${Math.random()}`,
        file,
        progress: 0,
        status: 'queued',
      }));

    if (validFiles.length === 0) {
      alert('Hanya file gambar (JPG, PNG, WEBP, TIFF, dsb.) yang didukung.');
      return;
    }

    setQueue((prev) => [...prev, ...validFiles]);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const startUpload = async () => {
    if (isUploading) return;
    setIsUploading(true);

    const uploadedResults: PhotoItem[] = [];
    const pendingItems = queue.filter((item) => item.status === 'queued' || item.status === 'error');

    for (const item of pendingItems) {
      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: 'uploading', progress: 0 } : q))
      );

      try {
        const photo = await uploadOriginalPhoto(
          accessToken,
          driveFolderId,
          item.file,
          (percent) => {
            setQueue((prev) =>
              prev.map((q) => (q.id === item.id ? { ...q, progress: percent } : q))
            );
          }
        );

        uploadedResults.push(photo);

        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: 'completed', progress: 100, photoResult: photo } : q
          )
        );
      } catch (err: any) {
        console.error('[UPLOAD] Error uploading file:', item.file.name, err);
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? { ...q, status: 'error', progress: 0, errorMessage: err?.message || 'Gagal upload' }
              : q
          )
        );
      }
    }

    setIsUploading(false);
    if (uploadedResults.length > 0) {
      onPhotosUploaded(uploadedResults);
    }
  };

  const handleRetryItem = async (itemId: string) => {
    const item = queue.find((q) => q.id === itemId);
    if (!item || isUploading) return;

    setQueue((prev) =>
      prev.map((q) => (q.id === itemId ? { ...q, status: 'uploading', progress: 0, errorMessage: undefined } : q))
    );

    try {
      const photo = await uploadOriginalPhoto(
        accessToken,
        driveFolderId,
        item.file,
        (percent) => {
          setQueue((prev) =>
            prev.map((q) => (q.id === itemId ? { ...q, progress: percent } : q))
          );
        }
      );

      setQueue((prev) =>
        prev.map((q) =>
          q.id === itemId ? { ...q, status: 'completed', progress: 100, photoResult: photo } : q
        )
      );
      onPhotosUploaded([photo]);
    } catch (err: any) {
      setQueue((prev) =>
        prev.map((q) =>
          q.id === itemId ? { ...q, status: 'error', progress: 0, errorMessage: err.message } : q
        )
      );
    }
  };

  const removeQueueItem = (id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  };

  const completedCount = queue.filter((q) => q.status === 'completed').length;
  const totalCount = queue.length;
  const overallProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Drag & Drop Area */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
          dragActive
            ? 'border-blue-500 bg-blue-50/50 scale-[0.99]'
            : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
        }`}
      >
        <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
          <Upload className="w-7 h-7" />
        </div>

        <h4 className="text-base font-bold text-slate-800">
          Tarik & Lepas Foto Asli ke Sini
        </h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
          Foto akan diunggah ke Google Drive dengan kualitas asli 100% tanpa kompresi file.
        </p>

        {/* Input Trigger Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
          >
            <ImageIcon className="w-4 h-4" />
            Pilih Foto Satuan / Banyak
          </button>

          <input
            ref={folderInputRef}
            type="file"
            multiple
            // @ts-ignore
            webkitdirectory=""
            directory=""
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
          >
            <FolderUp className="w-4 h-4 text-emerald-400" />
            Unggah Satu Folder Penuh
          </button>
        </div>
      </div>

      {/* Queue & Progress Section */}
      {queue.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Antrean Upload ({completedCount}/{totalCount} Selesai)
              </h5>
              <p className="text-xs text-slate-500">Progress keseluruhan: {overallProgress}%</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={startUpload}
                disabled={isUploading || completedCount === totalCount}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all ${
                  isUploading || completedCount === totalCount
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
                }`}
              >
                {isUploading ? 'Sedang Mengunggah...' : 'Mulai Unggah Semua'}
              </button>

              {!isUploading && completedCount === totalCount && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold"
                >
                  Selesai
                </button>
              )}
            </div>
          </div>

          {/* Overall Progress Bar */}
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
              style={{ width: `${overallProgress}%` }}
            />
          </div>

          {/* Individual File Items List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
            {queue.map((item) => (
              <div key={item.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/50">
                <div className="flex items-center gap-2.5 truncate max-w-[60%]">
                  {item.status === 'completed' && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
                  {item.status === 'uploading' && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin shrink-0" />}
                  {item.status === 'error' && <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />}
                  {item.status === 'queued' && <ImageIcon className="w-4 h-4 text-slate-400 shrink-0" />}

                  <div className="truncate">
                    <p className="font-medium text-slate-800 truncate">{item.file.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {(item.file.size / 1024 / 1024).toFixed(2)} MB
                      {item.errorMessage && <span className="text-rose-600 ml-2">• {item.errorMessage}</span>}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {item.status === 'uploading' && (
                    <span className="font-mono text-blue-600 font-semibold">{item.progress}%</span>
                  )}

                  {item.status === 'error' && !isUploading && (
                    <button
                      type="button"
                      onClick={() => handleRetryItem(item.id)}
                      className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="Coba lagi"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {!isUploading && item.status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() => removeQueueItem(item.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
