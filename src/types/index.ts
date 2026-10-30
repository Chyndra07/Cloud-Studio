export interface StudioProfile {
  uid: string;
  studioName: string;
  ownerEmail: string;
  ownerName: string;
  photoURL?: string;
  logoUrl?: string;
  bannerUrl?: string; // Custom Studio Hero Banner URL
  whatsappNumber?: string;
  emailContact?: string;
  address?: string;
  website?: string;
  brandColor?: string;
  driveRootFolderId?: string;
  driveRootFolderName?: string;
  createdAt: string;
  updatedAt: string;
}

export type ExpirationAction = 'disable' | 'trash';

export interface PhotoItem {
  id: string; // Drive file ID or generated unique ID
  driveFileId: string;
  name: string;
  size: number; // in bytes
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailUrl?: string;
  downloadUrl?: string;
  uploadedAt: string;
  width?: number;
  height?: number;
}

export interface Album {
  albumId: string;
  galleryId: string; // e.g. GFQ-4MUFZE
  ownerUid: string;
  studioId: string;
  albumName: string;
  clientName: string;
  eventName: string;
  eventDate?: string;
  driveFolderId: string;
  driveFolderName?: string;
  pin: string; // 4 digits or empty if disabled
  isPinEnabled: boolean;
  expirationDate: string; // ISO date string
  expirationAction: ExpirationAction;
  status: 'active' | 'expired' | 'disabled';
  isPublished: boolean;
  photoCount: number;
  coverPhotoUrl?: string;
  bannerUrl?: string; // Optional per-album custom banner override
  photos?: PhotoItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicGalleryData {
  galleryId: string;
  albumName: string;
  clientName: string;
  eventName: string;
  eventDate?: string;
  pin: string;
  isPinRequired: boolean;
  expirationDate: string;
  isExpired: boolean;
  status: 'active' | 'expired' | 'disabled';
  photoCount: number;
  coverPhotoUrl?: string;
  bannerUrl?: string;
  photos: PhotoItem[];
  studio: {
    studioName: string;
    logoUrl?: string;
    bannerUrl?: string;
    whatsappNumber?: string;
    emailContact?: string;
    brandColor?: string;
    website?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ClientSelection {
  galleryId: string;
  selectedPhotoIds: string[];
  notes: Record<string, string>; // photoId -> custom edit/print note
  updatedAt: string;
}

export interface TrashItem {
  id: string;
  type: 'album';
  name: string;
  deletedAt: string;
  originalData: any;
}

export interface DriveQuotaInfo {
  limit: number;
  usage: number;
  usageInDrive: number;
  usageInDriveTrash: number;
  userEmail: string;
  userName: string;
}
