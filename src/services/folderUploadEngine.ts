/**
 * Multi-Folder Upload Engine & Queue Manager for GaleriFotoQR Cloud Studio
 * 
 * Rules & Principles:
 * - WAJIB SELALU PERTAHANKAN FOLDER (Folder name, structure, subfolders, and files inside are strictly preserved)
 * - Multi-Folder Staging (+ Tambah Folder, stage multiple distinct folders like 01. Akad, 02. Resepsi, 03. Keluarga, 04. Tamu)
 * - Nested Subfolder Reconstruction (e.g. 01. Akad/Persiapan/001.jpg, 01. Akad/Prosesi/002.jpg)
 * - Recursive Drag & Drop support for multiple folders at once
 * - Controlled concurrency upload to Google Drive with automatic backoff retry
 * - Clean photo modeling with folderName, folderPath, subfolder, and driveFolderId
 */

import { Photo, Album, UserAccount } from '../types';
import { uploadPhotoFileToDrive, getOrCreateDriveFolderPath } from './googleDrive';

export interface StagedFile {
  file: File;
  relativePath: string;
  folderName: string;
  folderPath: string;
  subfolder: string;
  pathSegments: string[];
  size: number;
}

export interface StagedFolder {
  id: string;
  name: string;
  files: StagedFile[];
  validCount: number;
  totalSizeBytes: number;
  subfolders: string[];
  previewSampleUrls: { name: string; url: string; size: number }[];
  skippedFiles: { name: string; reason: string }[];
}

export interface MultiFolderUploadStats {
  totalFolders: number;
  currentFolderIndex: number;
  currentFolderName: string;
  totalFiles: number;
  processedFiles: number;
  successfulFiles: number;
  skippedFiles: number;
  failedFiles: number;
  percent: number;
  currentFileName: string;
  isComplete: boolean;
  isAborted: boolean;
  failedItems: { file: File; folderName: string; error: string }[];
}

// Supported image formats
const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'avif', 'bmp', 'tiff', 'tif'
]);

// Ignored OS system files and clutter
const IGNORED_SYSTEM_NAMES = new Set([
  '.ds_store', 'thumbs.db', 'desktop.ini', '.gitignore', '.git', '.svn', 'icon\r', 'ehthumbs.db'
]);

/**
 * Checks whether a file is a supported image
 */
export function isValidImageFile(file: File): boolean {
  const fileName = file.name.toLowerCase();

  if (fileName.startsWith('._') || fileName.startsWith('.~')) {
    return false;
  }

  if (IGNORED_SYSTEM_NAMES.has(fileName)) {
    return false;
  }

  const lastDotIdx = fileName.lastIndexOf('.');
  if (lastDotIdx === -1) return false;
  const ext = fileName.substring(lastDotIdx + 1);

  if (SUPPORTED_IMAGE_EXTENSIONS.has(ext)) {
    return true;
  }

  if (file.type && file.type.startsWith('image/')) {
    return true;
  }

  return false;
}

/**
 * Formats bytes to human-readable string (KB, MB, GB)
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Parses files and groups them into preserved StagedFolder items.
 * Can take existing staged folders and merge or append newly picked folders.
 */
export function scanMultipleFolders(
  newFiles: FileList | File[],
  existingStagedFolders: StagedFolder[] = []
): StagedFolder[] {
  const fileArray = Array.from(newFiles);
  if (fileArray.length === 0) return existingStagedFolders;

  // Temporary map by root folder name
  const folderMap = new Map<string, {
    files: StagedFile[];
    totalSize: number;
    subfolderSet: Set<string>;
    skipped: { name: string; reason: string }[];
  }>();

  // Populate existing folders first
  for (const existing of existingStagedFolders) {
    const subSet = new Set(existing.subfolders);
    folderMap.set(existing.name, {
      files: [...existing.files],
      totalSize: existing.totalSizeBytes,
      subfolderSet: subSet,
      skipped: [...existing.skippedFiles],
    });
  }

  for (const file of fileArray) {
    const relPath = file.webkitRelativePath || file.name;
    const parts = relPath.split('/').filter((p) => p.trim().length > 0);

    let rootFolderName = 'Folder Foto';
    let subfolder = '';
    let folderPath = '';
    let pathSegments: string[] = [];

    if (parts.length > 1) {
      rootFolderName = parts[0].trim();
      const subParts = parts.slice(1, -1); // folders in-between root and file
      subfolder = subParts.join('/');
      folderPath = parts.slice(0, -1).join('/');
      pathSegments = parts.slice(0, -1);
    } else {
      // Loose file without directory
      rootFolderName = 'Foto Langsung';
      folderPath = 'Foto Langsung';
      pathSegments = ['Foto Langsung'];
    }

    if (!folderMap.has(rootFolderName)) {
      folderMap.set(rootFolderName, {
        files: [],
        totalSize: 0,
        subfolderSet: new Set(),
        skipped: [],
      });
    }

    const group = folderMap.get(rootFolderName)!;

    if (isValidImageFile(file)) {
      // Avoid duplicate file references in the same folder stage
      const alreadyExists = group.files.some((f) => f.relativePath === relPath && f.size === file.size);
      if (!alreadyExists) {
        group.files.push({
          file,
          relativePath: relPath,
          folderName: rootFolderName,
          folderPath: folderPath || rootFolderName,
          subfolder,
          pathSegments,
          size: file.size,
        });
        group.totalSize += file.size;
        if (subfolder) {
          group.subfolderSet.add(subfolder);
        }
      }
    } else {
      const fileName = file.name.toLowerCase();
      if (!IGNORED_SYSTEM_NAMES.has(fileName) && !fileName.startsWith('._')) {
        group.skipped.push({
          name: file.name,
          reason: 'Format bukan gambar yang didukung',
        });
      }
    }
  }

  // Convert map to StagedFolder array
  const result: StagedFolder[] = [];
  folderMap.forEach((group, folderName) => {
    if (group.files.length === 0 && group.skipped.length === 0) return;

    // Create preview sample URLs (up to 8 samples)
    const previewSampleUrls: { name: string; url: string; size: number }[] = [];
    const sampleCount = Math.min(group.files.length, 8);
    for (let i = 0; i < sampleCount; i++) {
      const f = group.files[i].file;
      try {
        const url = URL.createObjectURL(f);
        previewSampleUrls.push({
          name: f.name,
          url,
          size: f.size,
        });
      } catch {
        // ignore
      }
    }

    result.push({
      id: `staged_folder_${folderName.replace(/\s+/g, '_')}_${Date.now()}`,
      name: folderName,
      files: group.files,
      validCount: group.files.length,
      totalSizeBytes: group.totalSize,
      subfolders: Array.from(group.subfolderSet),
      previewSampleUrls,
      skippedFiles: group.skipped,
    });
  });

  return result;
}

/**
 * Traverses DataTransferItems recursively to extract files with preserved webkitRelativePath
 * Handles multiple dropped folders & subfolders seamlessly across all browsers.
 */
export async function scanDroppedEntries(dataTransfer: DataTransfer): Promise<File[]> {
  const items = dataTransfer.items;
  const files: File[] = [];

  const readEntry = async (entry: any, path: string = ''): Promise<void> => {
    if (!entry) return;

    if (entry.isFile) {
      return new Promise<void>((resolve) => {
        entry.file((file: File) => {
          const filePath = path ? `${path}/${file.name}` : file.name;
          try {
            Object.defineProperty(file, 'webkitRelativePath', {
              value: filePath,
              writable: true,
              configurable: true,
            });
          } catch {
            (file as any).customRelativePath = filePath;
          }
          files.push(file);
          resolve();
        }, () => resolve());
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const nextPath = path ? `${path}/${entry.name}` : entry.name;

      const readAllEntries = async (): Promise<any[]> => {
        let all: any[] = [];
        let batch: any[] = [];
        do {
          batch = await new Promise((res) => dirReader.readEntries(res, () => res([])));
          all = all.concat(batch);
        } while (batch.length > 0);
        return all;
      };

      const dirEntries = await readAllEntries();
      for (const child of dirEntries) {
        await readEntry(child, nextPath);
      }
    }
  };

  if (items && items.length > 0) {
    const entryPromises: Promise<void>[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          entryPromises.push(readEntry(entry, ''));
        }
      }
    }

    if (entryPromises.length > 0) {
      await Promise.all(entryPromises);
      if (files.length > 0) return files;
    }
  }

  // Fallback to standard dataTransfer.files
  if (dataTransfer.files && dataTransfer.files.length > 0) {
    return Array.from(dataTransfer.files);
  }

  return [];
}

/**
 * Executes Multi-Folder Upload with strict folder & subfolder preservation.
 * Automatically recreates the folder tree in the target Google Drive album folder.
 */
export async function executeMultiFolderUploadQueue({
  stagedFolders,
  album,
  user,
  token,
  duplicatePolicy = 'skip',
  existingPhotoFilenames = [],
  concurrency = 3,
  maxRetries = 2,
  onProgress,
  signal,
}: {
  stagedFolders: StagedFolder[];
  album: Album;
  user: UserAccount;
  token: string | null;
  duplicatePolicy?: 'skip' | 'allow';
  existingPhotoFilenames?: string[];
  concurrency?: number;
  maxRetries?: number;
  onProgress: (stats: MultiFolderUploadStats) => void;
  signal?: AbortSignal;
}): Promise<{
  uploadedPhotos: Photo[];
  stats: MultiFolderUploadStats;
}> {
  const existingSet = new Set(existingPhotoFilenames.map((n) => n.toLowerCase().trim()));
  const uploadedPhotos: Photo[] = [];
  const failedItems: { file: File; folderName: string; error: string }[] = [];

  // Flatten staged files while retaining folder identity
  const allStagedFiles: StagedFile[] = [];
  for (const folder of stagedFolders) {
    for (const fileItem of folder.files) {
      allStagedFiles.push(fileItem);
    }
  }

  const totalFiles = allStagedFiles.length;
  let processedFiles = 0;
  let successfulFiles = 0;
  let skippedFiles = 0;
  let failedFiles = 0;
  let currentFolderIndex = 0;
  let currentFolderName = stagedFolders[0]?.name || '';

  // Google Drive folder cache to avoid repeated create/find API calls
  const driveFolderCache = new Map<string, string>();
  const albumDriveFolderId = album.driveFolderId || (album as any).googleDriveFolderId || null;

  // Filter duplicate files if policy is 'skip'
  const queueToUpload: StagedFile[] = [];
  for (const item of allStagedFiles) {
    // Check duplicate by filename + folderPath for precision
    const dupKey = `${item.folderPath}/${item.file.name}`.toLowerCase();
    const isDup = existingSet.has(dupKey) || existingSet.has(item.file.name.toLowerCase());

    if (isDup && duplicatePolicy === 'skip') {
      skippedFiles++;
      processedFiles++;
    } else {
      queueToUpload.push(item);
    }
  }

  const updateStats = (activeFileName: string = '', activeFolder: string = currentFolderName) => {
    const percent = totalFiles > 0 ? Math.round((processedFiles / totalFiles) * 100) : 100;
    onProgress({
      totalFolders: stagedFolders.length,
      currentFolderIndex,
      currentFolderName: activeFolder,
      totalFiles,
      processedFiles,
      successfulFiles,
      skippedFiles,
      failedFiles,
      percent,
      currentFileName: activeFileName,
      isComplete: processedFiles >= totalFiles,
      isAborted: signal?.aborted ?? false,
      failedItems,
    });
  };

  updateStats();

  if (queueToUpload.length === 0) {
    updateStats('', '');
    return {
      uploadedPhotos: [],
      stats: {
        totalFolders: stagedFolders.length,
        currentFolderIndex: stagedFolders.length,
        currentFolderName: '',
        totalFiles,
        processedFiles,
        successfulFiles: 0,
        skippedFiles,
        failedFiles: 0,
        percent: 100,
        currentFileName: '',
        isComplete: true,
        isAborted: false,
        failedItems: [],
      },
    };
  }

  // Upload single staged file with retry and drive subfolder placement
  const uploadSingleWithRetry = async (staged: StagedFile): Promise<Photo | null> => {
    if (signal?.aborted) return null;

    let attempts = 0;
    let lastError: any = null;

    // Resolve destination Google Drive folder ID for this specific subfolder path
    let targetDriveFolderId = albumDriveFolderId;

    if (token && albumDriveFolderId && !albumDriveFolderId.startsWith('mock_')) {
      try {
        if (staged.pathSegments && staged.pathSegments.length > 0) {
          targetDriveFolderId = await getOrCreateDriveFolderPath(
            token,
            albumDriveFolderId,
            staged.pathSegments,
            driveFolderCache
          );
        }
      } catch (folderErr: any) {
        console.warn(`[Drive Folder Structure] Notice on creating path for ${staged.folderPath}:`, folderErr?.message);
        targetDriveFolderId = albumDriveFolderId;
      }
    }

    while (attempts <= maxRetries) {
      if (signal?.aborted) return null;
      attempts++;

      try {
        let driveResult: any = null;
        if (token && targetDriveFolderId && !targetDriveFolderId.startsWith('mock_')) {
          driveResult = await uploadPhotoFileToDrive(token, targetDriveFolderId, staged.file);
        }

        const objectUrl = URL.createObjectURL(staged.file);
        const photoId = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        const newPhoto: Photo = {
          id: photoId,
          albumId: album.id,
          ownerId: album.ownerId || user.id,
          driveFileId: driveResult?.id || `local_${photoId}`,
          filename: staged.file.name,
          mimeType: staged.file.type || 'image/jpeg',
          thumbnailUrl: driveResult?.thumbnailUrl || objectUrl,
          previewUrl: driveResult?.previewUrl || driveResult?.thumbnailUrl || objectUrl,
          downloadUrl: driveResult?.downloadUrl || driveResult?.previewUrl || objectUrl,
          width: driveResult?.width || undefined,
          height: driveResult?.height || undefined,
          fileSize: driveResult?.size || staged.file.size,
          uploadedAt: new Date().toISOString(),
          isDeleted: false,
          folderName: staged.folderName,
          folderPath: staged.folderPath,
          subfolder: staged.subfolder,
          driveFolderId: targetDriveFolderId || undefined,
        };

        return newPhoto;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Upload Retry] Error uploading ${staged.file.name} in ${staged.folderPath} (attempt ${attempts}/${maxRetries + 1}):`, err?.message);
        if (attempts <= maxRetries) {
          await new Promise((r) => setTimeout(r, attempts * 600));
        }
      }
    }

    failedItems.push({
      file: staged.file,
      folderName: staged.folderName,
      error: lastError?.message || 'Gagal mengunggah file foto.',
    });
    return null;
  };

  // Concurrency worker loop
  let currentIndex = 0;

  const worker = async () => {
    while (currentIndex < queueToUpload.length) {
      if (signal?.aborted) break;

      const fileIndex = currentIndex++;
      const item = queueToUpload[fileIndex];

      currentFolderName = item.folderName;
      const folderIdx = stagedFolders.findIndex((f) => f.name === item.folderName);
      if (folderIdx !== -1) {
        currentFolderIndex = folderIdx + 1;
      }

      updateStats(item.file.name, item.folderName);

      const result = await uploadSingleWithRetry(item);

      if (signal?.aborted) break;

      if (result) {
        uploadedPhotos.push(result);
        successfulFiles++;
      } else {
        failedFiles++;
      }

      processedFiles++;
      updateStats(item.file.name, item.folderName);
    }
  };

  const activeWorkers: Promise<void>[] = [];
  const workerCount = Math.min(concurrency, queueToUpload.length);

  for (let i = 0; i < workerCount; i++) {
    activeWorkers.push(worker());
  }

  await Promise.all(activeWorkers);

  updateStats('', '');

  return {
    uploadedPhotos,
    stats: {
      totalFolders: stagedFolders.length,
      currentFolderIndex: stagedFolders.length,
      currentFolderName: '',
      totalFiles,
      processedFiles,
      successfulFiles,
      skippedFiles,
      failedFiles,
      percent: 100,
      currentFileName: '',
      isComplete: true,
      isAborted: signal?.aborted ?? false,
      failedItems,
    },
  };
}
