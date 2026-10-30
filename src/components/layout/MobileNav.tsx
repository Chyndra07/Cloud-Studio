import React from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  Trash2,
  Palette,
  Settings,
  X,
  Camera,
  LogOut,
  HardDrive,
} from 'lucide-react';
import { StudioProfile } from '../../types';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: string;
  onSelectTab: (tab: string) => void;
  profile: StudioProfile | null;
  onSignOut: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  isOpen,
  onClose,
  currentTab,
  onSelectTab,
  profile,
  onSignOut,
}) => {
  if (!isOpen) return null;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'albums', label: 'Album Pelanggan', icon: FolderKanban },
    { id: 'trash', label: 'Keranjang Sampah', icon: Trash2 },
    { id: 'branding', label: 'Profil & Branding', icon: Palette },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
  ];

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      {/* Slide Drawer */}
      <div className="relative w-72 max-w-[80vw] bg-slate-900 text-slate-300 flex flex-col h-full z-10">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white border border-slate-700/60 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
              {profile?.logoUrl ? (
                <img
                  src={profile.logoUrl}
                  alt={profile?.studioName || 'Logo Studio'}
                  className="w-full h-full object-contain rounded-full"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-blue-600 flex items-center justify-center text-white">
                  <Camera className="w-6 h-6" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 truncate">
              <h3
                className="text-sm font-bold text-white tracking-tight truncate leading-tight"
                title={profile?.studioName || 'GaleriFotoQR'}
              >
                {profile?.studioName || 'GaleriFotoQR'}
              </h3>
              <p
                className="text-[9px] font-semibold uppercase tracking-widest block mt-0.5 truncate"
                style={{ color: profile?.brandColor || '#38bdf8' }}
              >
                CLOUD STUDIO
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold ${
                  isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <span className="text-xs text-slate-400 truncate max-w-[150px]">
            {profile?.ownerEmail}
          </span>
          <button
            onClick={onSignOut}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
