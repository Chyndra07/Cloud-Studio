export type ViewMode = 
  | 'dashboard'
  | 'albums'
  | 'album-detail'
  | 'trash'
  | 'drive-status'
  | 'branding'
  | 'settings'
  | 'help'
  | 'admin-saas'
  | 'public-gallery';

export interface UserAccount {
  id: string; // Google sub / unique ID
  email: string;
  name: string;
  avatarUrl?: string;
  accessToken?: string;
  tokenExpiresAt?: number;
  isConnectedToDrive: boolean;
  driveRootFolderId?: string;
  driveAlbumFolderId?: string;
  role: 'studio_owner' | 'platform_admin';
  subscriptionTier: 'starter' | 'pro' | 'agency';
  subscriptionStatus: 'active' | 'trial' | 'expired';
  createdAt: string;
}

export interface StudioProfile {
  studioName: string;
  tagline: string;
  logoUrl?: string;
  studioLogoUrl?: string; // Standard alias for studioLogoUrl
  studioLogoPath?: string;
  whatsappNumber: string;
  instagram: string;
  website: string;
  address: string;
  accentColor: string; // Hex color (e.g., #f59e0b)
  watermarkEnabled: boolean;
  watermarkText: string;
  watermarkPosition: 'bottom-right' | 'bottom-left' | 'center' | 'top-right';
  galleryFooterText: string;
  welcomeMessage: string;
  allowClientDownload: boolean;
  allowBatchZipDownload: boolean;
  customGalleryDomain?: string; // Custom public base URL e.g. https://galeri.luminastudio.com
  updatedAt?: string;
}

export interface Album {
  id: string;
  galleryId: string; // Random unguessable URL slug (e.g. GFQ-7a9b2c)
  ownerId: string; // Must match UserAccount.id for isolation
  customerName: string;
  eventName: string;
  eventDate: string;
  description?: string;
  coverPhotoUrl?: string;
  isPasswordProtected: boolean;
  passwordHash?: string;
  isPublished?: boolean;
  status?: string;
  pinEnabled?: boolean;
  pinHash?: string;
  expiresAt?: string; // ISO date or null
  expiryAction?: 'disable' | 'trash'; // Action when expired
  driveFolderId?: string;
  driveFolderUrl?: string;
  displayQuality: 'light' | 'hd';
  customFolders?: string[]; // Defined folders in album (including 0-photo empty folders)
  photosCount: number;
  viewsCount: number;
  downloadsCount: number;
  isDeleted: boolean; // Soft delete
  deletedAt?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Photo {
  id: string;
  albumId: string;
  ownerId: string;
  filename: string;
  fileSize: number; // in bytes
  size?: number; // alias for fileSize
  mimeType: string;
  driveFileId: string;
  thumbnailUrl: string;
  previewUrl: string;
  downloadUrl: string;
  width?: number;
  height?: number;
  isDeleted: boolean;
  deletedAt?: string;
  uploadedAt: string;
  folderName?: string; // Root folder name e.g. "01. Akad"
  folderPath?: string; // Full relative path e.g. "01. Akad/Persiapan" or "01. Akad"
  subfolder?: string; // Nested subfolder name e.g. "Persiapan"
  driveFolderId?: string; // Specific Google Drive folder ID for this subfolder
}

export interface DriveStorageQuota {
  limitBytes: number;
  usageBytes: number;
  usageInDriveBytes: number;
  usageInDriveTrashBytes: number;
  userEmail: string;
  userName: string;
  lastSyncedAt: string;
}

export interface UploadProgress {
  totalFiles: number;
  uploadedFiles: number;
  currentFileName: string;
  percent: number;
  isUploading: boolean;
  error?: string;
}

export interface StudioTenantRecord {
  id: string;
  studioName: string;
  ownerName: string;
  email: string;
  plan: 'starter' | 'pro' | 'agency';
  status: 'active' | 'trial' | 'suspended';
  activeAlbumsCount: number;
  totalPhotosCount: number;
  driveConnected: boolean;
  joinedAt: string;
}
