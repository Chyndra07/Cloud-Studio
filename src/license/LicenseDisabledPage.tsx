import React from 'react';
import { User } from 'firebase/auth';
import { Ban, LogOut, ExternalLink, HardDrive } from 'lucide-react';
import { LicensePublicData } from './licenseTypes';

interface LicenseDisabledPageProps {
  user: User;
  license?: LicensePublicData;
  onRefreshCheck: () => void;
  onSignOut: () => void;
  onOpenDeveloperPanel?: () => void;
}

export const LicenseDisabledPage: React.FC<LicenseDisabledPageProps> = ({
  user,
  license,
  onRefreshCheck,
  onSignOut,
  onOpenDeveloperPanel,
}) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6">
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4 border-b border-slate-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-700 flex items-center justify-center text-white shadow-lg shadow-rose-600/20">
            <Ban className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white tracking-tight">GaleriFotoQR</h1>
            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest block">
              Akses Dinonaktifkan
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenDeveloperPanel && (
            <button
              onClick={onOpenDeveloperPanel}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
            >
              Developer Panel
            </button>
          )}

          <button
            onClick={onSignOut}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-semibold"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar Akun</span>
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto w-full my-auto py-8">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
            <Ban className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white tracking-tight">Lisensi Telah Dinonaktifkan</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Lisensi aplikasi untuk akun <strong>{user.email}</strong> telah dinonaktifkan oleh administrator sistem.
            </p>
          </div>

          <div className="p-3.5 bg-blue-950/40 border border-blue-900/60 text-blue-300 text-xs rounded-xl flex items-start gap-2.5 text-left">
            <HardDrive className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong>Data Anda Aman di Google Drive:</strong> Seluruh berkas dan foto Anda tetap berada di Google Drive Anda secara mandiri.
            </p>
          </div>

          <div className="pt-2">
            <a
              href="https://wa.me/6281234567890"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-6 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <span>Hubungi Layanan Pengembang</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </main>

      <footer className="max-w-4xl mx-auto w-full text-center py-4 border-t border-slate-900 text-xs text-slate-600">
        GaleriFotoQR Cloud Studio • License Access Control
      </footer>
    </div>
  );
};
