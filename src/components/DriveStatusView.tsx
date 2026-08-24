import React, { useState } from 'react';
import { 
  HardDrive, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  RefreshCw, 
  LogOut, 
  FolderOpen, 
  ShieldCheck, 
  Database, 
  Zap, 
  Sparkles,
  Lock
} from 'lucide-react';
import { UserAccount, DriveStorageQuota, StudioProfile } from '../types';

interface DriveStatusViewProps {
  user: UserAccount | null;
  studioProfile: StudioProfile;
  driveQuota: DriveStorageQuota | null;
  onConnectDrive: () => void;
  onDisconnectDrive: () => void;
  onRefreshQuota: () => void;
}

export const DriveStatusView: React.FC<DriveStatusViewProps> = ({
  user,
  studioProfile,
  driveQuota,
  onConnectDrive,
  onDisconnectDrive,
  onRefreshQuota,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    return gb.toFixed(2) + ' GB';
  };

  const usageBytes = driveQuota?.usageBytes || (user?.isConnectedToDrive ? 2500000000 : 0);
  const limitBytes = driveQuota?.limitBytes || 16106127360; // 15 GB
  const usagePercent = Math.min(100, Math.round((usageBytes / limitBytes) * 100));

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await onRefreshQuota();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Status Google Drive Studio
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Informasi konektivitas Google Drive mandiri milik studio Anda untuk penyimpanan galeri foto.
        </p>
      </div>

      {/* Main Status Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xs relative overflow-hidden">
        {/* Status Indicator Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xs ${
                user?.isConnectedToDrive
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : 'bg-rose-50 text-rose-600 border border-rose-200'
              }`}
            >
              <HardDrive className="w-7 h-7" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Koneksi Google Drive:
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    user?.isConnectedToDrive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${user?.isConnectedToDrive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                  {user?.isConnectedToDrive ? '● Terhubung Aktif' : 'Terputus'}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
                {user?.email || 'Belum Terhubung'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition border border-slate-200 cursor-pointer"
              title="Sinkronisasi Ulang Kapasitas"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            {user?.isConnectedToDrive && (
              <a
                href="https://drive.google.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition cursor-pointer"
              >
                <ExternalLink className="w-4 h-4 text-emerald-600" />
                <span>Buka Google Drive</span>
              </a>
            )}
          </div>
        </div>

        {/* Technical Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Folder Root Aplikasi di Google Drive
            </span>
            <p className="text-sm font-bold text-slate-900 font-mono flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-blue-600" />
              GaleriFotoQR / Album Pelanggan
            </p>
            <p className="text-[11px] text-slate-500">
              Dibuat otomatis tanpa perlu konfigurasi folder manual.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Tingkat Izin Keamanan (OAuth Scope)
            </span>
            <p className="text-sm font-bold text-emerald-700 flex items-center gap-2 font-mono text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              auth/drive.file (Minimum Permission)
            </p>
            <p className="text-[11px] text-slate-500">
              Hanya mengakses folder & file yang dibuat melalui aplikasi GaleriFotoQR.
            </p>
          </div>
        </div>

        {/* Storage Quota Gauge */}
        <div className="space-y-3 p-5 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-700" />
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Kapasitas Google Drive Studio
              </span>
            </div>
            <span className="text-xs font-bold text-slate-900">
              {formatBytes(usageBytes)} / {formatBytes(limitBytes)} ({usagePercent}%)
            </span>
          </div>

          <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${usagePercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
            <span>Tersisa: {formatBytes(limitBytes - usageBytes)}</span>
            <span>Sinkronisasi otomatis setiap unggahan foto</span>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-slate-900">Hubungkan Ulang / Ganti Akun Google</h4>
            <p className="text-[11px] text-slate-500">
              Gunakan akun Google lain atau perbarui sesi izin Drive sewaktu-waktu.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onConnectDrive}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition transform active:scale-98 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Hubungkan Ulang Google Drive</span>
            </button>

            {user?.isConnectedToDrive && (
              <button
                onClick={onDisconnectDrive}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold hover:bg-rose-100 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Putuskan Sambungan</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Multi-Tenant Security Promise Box */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 text-xs space-y-2 shadow-2xs">
        <h4 className="font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Multi-Tenant Isolation Guarantee
        </h4>
        <p className="text-slate-600 leading-relaxed">
          Sistem GaleriFotoQR dibangun dengan arsitektur multi-tenant sejati. Seluruh file foto klien disimpan di penyimpanan Google Drive akun Anda masing-masing, bukan di server terpusat. Studio lain tidak pernah memiliki akses ke akun atau file Google Drive Anda.
        </p>
      </div>
    </div>
  );
};
