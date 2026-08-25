import React from 'react';
import { Plus, Menu, HardDrive, ShieldCheck, RefreshCw } from 'lucide-react';
import { StudioProfile } from '../../types';

interface NavbarProps {
  title: string;
  subtitle?: string;
  profile: StudioProfile | null;
  isDriveConnected: boolean;
  onOpenCreateAlbum: () => void;
  onRefresh: () => void;
  onToggleMobileMenu: () => void;
  isRefreshing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  title,
  subtitle,
  profile,
  isDriveConnected,
  onOpenCreateAlbum,
  onRefresh,
  onToggleMobileMenu,
  isRefreshing,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Segarkan Data"
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
        </button>

        <button
          onClick={onOpenCreateAlbum}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-blue-500/20 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Buat Album Baru</span>
          <span className="sm:hidden">Album</span>
        </button>
      </div>
    </header>
  );
};
