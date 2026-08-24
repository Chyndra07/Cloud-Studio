import React, { useState } from 'react';
import { 
  Camera, 
  HardDrive, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Building2, 
  LogOut, 
  ChevronDown, 
  Menu, 
  ShieldCheck, 
  Plus,
  RefreshCw,
  ExternalLink,
  Sparkles,
  QrCode,
  UserCheck
} from 'lucide-react';
import { UserAccount, StudioProfile } from '../types';

interface NavbarProps {
  user: UserAccount | null;
  studioProfile: StudioProfile;
  onLogout: () => void;
  onSwitchStudio?: (studioUser: UserAccount) => void;
  onOpenDriveStatus: () => void;
  onOpenAdminSaaS: () => void;
  onOpenCreateAlbum: () => void;
  onToggleMobileSidebar: () => void;
  isInstallable: boolean;
  onInstallPwa: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  studioProfile,
  onLogout,
  onOpenDriveStatus,
  onOpenAdminSaaS,
  onOpenCreateAlbum,
  onToggleMobileSidebar,
  isInstallable,
  onInstallPwa,
}) => {
  const [showWorkspaceSwitcher, setShowWorkspaceSwitcher] = useState(false);
  const isDriveConnected = !!user && !!user.isConnectedToDrive;

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 lg:px-8 py-3.5 transition-all shadow-2xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Mobile menu toggle + Header Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileSidebar}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition"
            aria-label="Toggle Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 select-none">
            {(studioProfile.studioLogoUrl || studioProfile.logoUrl) ? (
              <div className="h-9 w-9 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shadow-xs overflow-hidden shrink-0">
                <img
                  src={studioProfile.studioLogoUrl || studioProfile.logoUrl}
                  alt={studioProfile.studioName}
                  className="max-h-full max-w-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs font-bold shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-slate-900 text-base">
                  {studioProfile.studioName || (user ? user.name + ' Studio' : 'GaleriFotoQR Cloud Studio')}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  <Sparkles className="w-3 h-3" /> Multi-Tenant Studio
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal truncate max-w-[200px] sm:max-w-xs">
                {studioProfile.tagline || 'Dashboard Pengelolaan Galeri & QR Code'}
              </p>
            </div>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Drive Status Badge */}
          <button
            onClick={onOpenDriveStatus}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 transition cursor-pointer"
            title="Status Google Drive Studio"
          >
            <span className={`w-2 h-2 rounded-full ${isDriveConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-slate-600">Drive:</span>
            <span className="font-semibold text-slate-900 truncate max-w-[120px]">
              {isDriveConnected ? (user?.email ? user.email.split('@')[0] : 'Aktif') : 'Belum Terhubung'}
            </span>
          </button>

          {/* User Account Menu */}
          <div className="relative">
            <button
              onClick={() => setShowWorkspaceSwitcher(!showWorkspaceSwitcher)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 transition cursor-pointer"
              title="Kelola Akun Google & Studio"
            >
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span className="max-w-[110px] truncate">{user?.name || 'Studio'}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showWorkspaceSwitcher && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-slate-900">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    Multi-Tenant Workspace
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Setiap studio memiliki Google Drive & galeri terisolasi secara independen.
                  </p>
                </div>

                <div className="py-2 px-2 space-y-1">
                  {user ? (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-xs font-bold text-slate-900 truncate">{user.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {user.isConnectedToDrive ? 'Google Drive Terhubung' : 'Google Drive Terputus'}
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                      <p className="text-xs font-bold text-slate-900">Belum Masuk Akun</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Hubungkan akun Google Drive Anda</p>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setShowWorkspaceSwitcher(false);
                      onOpenDriveStatus();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer font-medium"
                  >
                    <HardDrive className="w-4 h-4 text-slate-500" />
                    <span>Kelola Koneksi Google Drive</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowWorkspaceSwitcher(false);
                      onLogout();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs text-rose-600 hover:bg-rose-50 transition cursor-pointer font-medium"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>{user ? 'Keluar dari Akun' : 'Hubungkan Akun Google'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Primary CTA: Buat Album Baru in Blue */}
          <button
            onClick={onOpenCreateAlbum}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs sm:text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden xs:inline">Buat Album Baru</span>
            <span className="xs:hidden">Album</span>
          </button>
        </div>
      </div>
    </header>
  );
};
