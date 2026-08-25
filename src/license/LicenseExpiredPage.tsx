import React from 'react';
import { User } from 'firebase/auth';
import { Clock, ShieldAlert, LogOut, ExternalLink, RefreshCw, HardDrive } from 'lucide-react';
import { LicensePublicData } from './licenseTypes';

interface LicenseExpiredPageProps {
  user: User;
  license?: LicensePublicData;
  onRefreshCheck: () => void;
  onSignOut: () => void;
  onOpenDeveloperPanel?: () => void;
}

export const LicenseExpiredPage: React.FC<LicenseExpiredPageProps> = ({
  user,
  license,
  onRefreshCheck,
  onSignOut,
  onOpenDeveloperPanel,
}) => {
  const planLabel = license?.plan
    ? license.plan === 'lifetime'
      ? 'Permanen'
      : license.plan === 'yearly'
      ? 'Langganan Tahunan'
      : license.plan === 'monthly'
      ? 'Langganan Bulanan'
      : 'Uji Coba (Trial)'
    : 'Langganan Studio';

  const formattedDate = license?.expiresAt
    ? new Date(license.expiresAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Telah Berakhir';

  const whatsappMessage = encodeURIComponent(
    `Halo Admin GaleriFotoQR, masa lisensi akun saya telah berakhir (${user.email} / UID: ${user.uid}). Saya ingin melakukan perpanjangan lisensi ${planLabel}.`
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6">
      {/* Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4 border-b border-slate-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white tracking-tight">GaleriFotoQR</h1>
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">
              Masa Lisensi Berakhir
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

      {/* Main Expired Content */}
      <main className="max-w-lg mx-auto w-full my-auto py-8">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white tracking-tight">Masa Lisensi Telah Berakhir</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Masa aktif lisensi aplikasi untuk akun Google Anda telah habis pada <strong>{formattedDate}</strong>.
            </p>
          </div>

          {/* Details Card */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-left space-y-3 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
              <span className="text-slate-500">Akun Google</span>
              <span className="font-bold text-white truncate max-w-[180px]">{user.email}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
              <span className="text-slate-500">Paket Lisensi</span>
              <span className="font-bold text-amber-400">{planLabel}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Berakhir Pada</span>
              <span className="font-mono text-slate-300">{formattedDate}</span>
            </div>
          </div>

          {/* Google Drive safety assurance note */}
          <div className="p-3.5 bg-blue-950/40 border border-blue-900/60 text-blue-300 text-xs rounded-xl flex items-start gap-2.5 text-left">
            <HardDrive className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong>Data Anda 100% Aman:</strong> Semua album foto dan file Anda di Google Drive tetap tersimpan rapi dan tidak dihapus. Setelah lisensi diperpanjang, akses studio akan langsung aktif kembali.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <a
              href={`https://wa.me/6281234567890?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold shadow-xl shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
            >
              <span>PERPANJANG LISENSI (HUBUNGI PENJUAL)</span>
              <ExternalLink className="w-4 h-4" />
            </a>

            <button
              onClick={onRefreshCheck}
              className="w-full py-3 px-6 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-semibold transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Sudah Memperpanjang? Cek Ulang Status</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto w-full text-center py-4 border-t border-slate-900 text-xs text-slate-600">
        GaleriFotoQR Cloud Studio • Proteksi Akses & Kedaulatan Data Pengguna
      </footer>
    </div>
  );
};
