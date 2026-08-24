import React, { useState } from 'react';
import { 
  Camera, 
  HardDrive, 
  ShieldCheck, 
  Sparkles, 
  Zap, 
  CheckCircle2, 
  Building2, 
  ArrowRight, 
  RefreshCw, 
  Lock,
  QrCode,
  UserCheck,
  X
} from 'lucide-react';
import { UserAccount } from '../types';
import { requestGoogleDriveAuth, saveActiveUserSession } from '../services/googleAuth';
import { initAppDriveStructure } from '../services/googleDrive';
import { getStudioProfile, saveStudioProfile } from '../services/storageService';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onLoginSuccess: (user: UserAccount) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const { accessToken, userInfo } = await requestGoogleDriveAuth();

      // Initialize default root folder structure in Google Drive
      let driveRootFolderId: string | undefined = undefined;
      let driveAlbumFolderId: string | undefined = undefined;

      try {
        const driveInit = await initAppDriveStructure(accessToken);
        driveRootFolderId = driveInit.rootFolderId;
        driveAlbumFolderId = driveInit.albumsFolderId;
      } catch (err: any) {
        console.warn('Drive structure initialization warning:', err?.message);
      }

      const userAccount: UserAccount = {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        avatarUrl: userInfo.picture,
        accessToken: accessToken,
        tokenExpiresAt: Date.now() + 3600 * 1000,
        isConnectedToDrive: true,
        driveRootFolderId,
        driveAlbumFolderId,
        role: 'studio_owner',
        subscriptionTier: 'pro',
        subscriptionStatus: 'active',
        createdAt: new Date().toISOString(),
      };

      // Set default personalized studio profile if not yet customized
      const existingProfile = getStudioProfile(userInfo.id);
      if (!existingProfile.studioName || existingProfile.studioName === 'Studio Foto' || existingProfile.studioName === '') {
        const fallbackName = userInfo.name 
          ? `${userInfo.name} Studio`
          : userInfo.email.includes('@') 
            ? `${userInfo.email.split('@')[0].toUpperCase()} Studio`
            : 'GaleriFotoQR Studio';
            
        saveStudioProfile(userInfo.id, {
          ...existingProfile,
          studioName: fallbackName,
          tagline: 'Platform Galeri Foto & QR Code Cloud',
        });
      }

      saveActiveUserSession(userAccount);
      onLoginSuccess(userAccount);
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Gagal menghubungkan akun Google. Pastikan jendela popup diizinkan pada browser.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6 my-8 animate-in fade-in zoom-in-95 duration-200">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header Icon */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xs font-bold">
            <QrCode className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              GaleriFotoQR Cloud Studio
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
              Hubungkan akun Google Drive Anda untuk mengaktifkan sinkronisasi galeri foto studio & barcode QR pelanggan.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium text-center leading-relaxed">
            {errorMessage}
          </div>
        )}

        {/* Primary OAuth Action Button */}
        <div className="space-y-3">
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-xs transition transform active:scale-98 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Menghubungkan Akun Google...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Hubungkan Akun Google (1-Click)</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-center text-slate-500">
            Aman & resmi dengan OAuth 2.0. Aplikasi hanya mengakses folder foto yang dibuat untuk studio Anda.
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Folder Google Drive studio terbuat otomatis</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>QR Code unik instan untuk setiap pelanggan</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Multi-tenant terisolasi per akun Google</span>
          </div>
        </div>
      </div>
    </div>
  );
};
