import React from 'react';
import { 
  LayoutDashboard, 
  Images, 
  Trash2, 
  HardDrive, 
  Palette, 
  Settings, 
  HelpCircle, 
  LogOut, 
  ShieldAlert, 
  Sparkles,
  QrCode,
  FolderOpen
} from 'lucide-react';
import { ViewMode, StudioProfile, UserAccount } from '../types';

interface SidebarProps {
  currentView: ViewMode;
  onNavigate: (view: ViewMode) => void;
  albumsCount: number;
  trashCount: number;
  isDriveConnected: boolean;
  studioProfile: StudioProfile;
  user: UserAccount | null;
  onLogout: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  albumsCount,
  trashCount,
  isDriveConnected,
  studioProfile,
  user,
  onLogout,
  isOpenMobile,
  onCloseMobile,
}) => {
  const menuItems = [
    {
      id: 'dashboard' as ViewMode,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'albums' as ViewMode,
      label: 'Album Pelanggan',
      icon: Images,
      badge: albumsCount > 0 ? albumsCount : null,
      badgeColor: 'bg-blue-50 text-blue-700 border border-blue-200',
    },
    {
      id: 'trash' as ViewMode,
      label: 'Keranjang Sampah',
      icon: Trash2,
      badge: trashCount > 0 ? trashCount : null,
      badgeColor: 'bg-slate-100 text-slate-600 border border-slate-200',
    },
    {
      id: 'drive-status' as ViewMode,
      label: 'Status Google Drive',
      icon: HardDrive,
      statusDot: isDriveConnected ? 'bg-emerald-500' : 'bg-rose-500',
    },
    {
      id: 'branding' as ViewMode,
      label: 'Profil & Branding',
      icon: Palette,
    },
    {
      id: 'settings' as ViewMode,
      label: 'Pengaturan',
      icon: Settings,
    },
    {
      id: 'help' as ViewMode,
      label: 'Bantuan & Panduan',
      icon: HelpCircle,
    },
  ];

  const handleItemClick = (view: ViewMode) => {
    onNavigate(view);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        } lg:static lg:z-10`}
      >
        {/* Top Brand Header */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {(studioProfile.studioLogoUrl || studioProfile.logoUrl) ? (
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shadow-xs overflow-hidden shrink-0">
                <img
                  src={studioProfile.studioLogoUrl || studioProfile.logoUrl}
                  alt={studioProfile.studioName}
                  className="max-h-full max-w-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs font-bold shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
            )}
            <div className="overflow-hidden min-w-0">
              <h2 className="font-bold text-sm text-slate-900 truncate">
                {studioProfile.studioName || (user ? user.name + ' Studio' : 'GaleriFotoQR Cloud Studio')}
              </h2>
              <p className="text-[11px] text-slate-500 truncate">
                {isDriveConnected && user?.email ? user.email : 'Google Drive Belum Terhubung'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Menu Studio
          </p>

          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-100 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition ${
                      isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge !== null && item.badge !== undefined && (
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      isActive ? 'bg-blue-600 text-white' : (item.badgeColor || 'bg-slate-100 text-slate-700')
                    }`}
                  >
                    {item.badge}
                  </span>
                )}

                {item.statusDot && (
                  <span className={`w-2 h-2 rounded-full ${item.statusDot} ${isDriveConnected ? 'animate-pulse' : ''}`} />
                )}
              </button>
            );
          })}

          <div className="pt-4 mt-4 border-t border-slate-100">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              SaaS & Manajemen
            </p>

            <button
              onClick={() => handleItemClick('admin-saas')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                currentView === 'admin-saas'
                  ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-100 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShieldAlert className={`w-4 h-4 ${currentView === 'admin-saas' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>Platform Owner</span>
              </div>
              <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${
                currentView === 'admin-saas' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}>
                Admin
              </span>
            </button>
          </div>
        </div>

        {/* Bottom Footer Info + Logout */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
          {/* Drive Status Info Box */}
          <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-600 font-medium flex items-center gap-1.5">
                <HardDrive className={`w-3.5 h-3.5 ${isDriveConnected ? 'text-emerald-600' : 'text-rose-500'}`} />
                Google Drive
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                isDriveConnected
                  ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                  : 'text-rose-700 bg-rose-50 border border-rose-200'
              }`}>
                {isDriveConnected ? 'Terhubung' : 'Belum Terhubung'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 truncate">
              {isDriveConnected && user?.email ? user.email : 'Belum Terhubung'}
            </p>
          </div>

          <button
            onClick={() => {
              onLogout();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar dari Akun</span>
          </button>
        </div>
      </aside>
    </>
  );
};
