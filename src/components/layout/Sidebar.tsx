import React from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  Trash2,
  Palette,
  Settings,
  HardDrive,
  ExternalLink,
  LogOut,
  Camera,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { StudioProfile } from '../../types';
import { StorageQuotaInfo } from '../../hooks/useStudioData';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  profile: StudioProfile | null;
  quota: StorageQuotaInfo | null;
  isDriveConnected: boolean;
  onConnectDrive: () => void;
  onSignOut: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  profile,
  quota,
  isDriveConnected,
  onConnectDrive,
  onSignOut,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'albums', label: 'Album Pelanggan', icon: FolderKanban },
    { id: 'trash', label: 'Keranjang Sampah', icon: Trash2 },
    { id: 'branding', label: 'Profil & Branding', icon: Palette },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
  ];

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const usedStorage = quota ? formatBytes(quota.usage) : '0 GB';
  const totalStorage = quota && quota.limit > 0 ? formatBytes(quota.limit) : '15 GB';
  const percentStorage = quota && quota.limit > 0 ? Math.min(100, Math.round((quota.usage / quota.limit) * 100)) : 0;

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-screen shrink-0 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0 overflow-hidden">
          {profile?.logoUrl ? (
            <img src={profile.logoUrl} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <Camera className="w-5 h-5" />
          )}
        </div>
        <div className="truncate">
          <h1 className="text-sm font-bold text-white tracking-tight truncate">
            {profile?.studioName || 'GaleriFotoQR'}
          </h1>
          <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-widest block">
            Cloud Studio
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Google Drive Status & Quota Card */}
      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <HardDrive className="w-4 h-4 text-blue-400" />
              Google Drive
            </div>
            {isDriveConnected ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                Aktif
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-950/60 border border-amber-800/40 px-2 py-0.5 rounded-full">
                <AlertTriangle className="w-3 h-3" />
                Terputus
              </span>
            )}
          </div>

          {isDriveConnected ? (
            <div className="space-y-1.5">
              <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all"
                  style={{ width: `${percentStorage}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>{usedStorage} terpakai</span>
                <span>{totalStorage}</span>
              </div>
            </div>
          ) : (
            <button
              onClick={onConnectDrive}
              className="w-full text-center py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
            >
              Hubungkan Drive
            </button>
          )}
        </div>
      </div>

      {/* User Footer & Logout */}
      <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center gap-2.5 truncate max-w-[170px]">
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="User" className="w-8 h-8 rounded-full border border-slate-700 shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-xs shrink-0">
              {profile?.ownerName?.charAt(0) || 'U'}
            </div>
          )}
          <div className="truncate">
            <p className="text-xs font-semibold text-slate-200 truncate">{profile?.ownerName || 'Admin'}</p>
            <p className="text-[10px] text-slate-500 truncate">{profile?.ownerEmail}</p>
          </div>
        </div>

        <button
          onClick={onSignOut}
          title="Keluar"
          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
