import React, { useState, useEffect } from 'react';
import {
  Globe,
  HardDrive,
  Database,
  Download,
  Upload,
  Check,
  RefreshCw,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { StudioProfile, Album } from '../types';
import { StorageQuotaInfo } from '../hooks/useStudioData';
import { LicensePublicData } from '../license/licenseTypes';
import { LicenseStatusCard } from '../license/LicenseStatusCard';
import {
  getFrontendPublicUrl,
  setFrontendPublicUrl,
  getApiBaseUrl,
  setApiBaseUrl,
  DEFAULT_ROOT_FOLDER_NAME,
} from '../config/appConfig';

interface SettingsPageProps {
  profile: StudioProfile | null;
  quota: StorageQuotaInfo | null;
  isDriveConnected: boolean;
  albums: Album[];
  license?: LicensePublicData | null;
  onConnectDrive: () => void;
  onRefreshData: () => void;
  onRefreshLicense?: () => Promise<void>;
  onOpenDeveloperPanel?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  profile,
  quota,
  isDriveConnected,
  albums,
  license,
  onConnectDrive,
  onRefreshData,
  onRefreshLicense,
  onOpenDeveloperPanel,
}) => {
  const [frontendUrl, setFrontendUrlState] = useState(getFrontendPublicUrl());
  const [apiUrl, setApiUrlState] = useState(getApiBaseUrl());
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveUrls = (e: React.FormEvent) => {
    e.preventDefault();
    setFrontendPublicUrl(frontendUrl);
    setApiBaseUrl(apiUrl);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleExportBackup = () => {
    const backupData = {
      exportedAt: new Date().toISOString(),
      profile,
      albums,
      version: '1.0.0',
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GaleriFotoQR_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Pengaturan Studio & Arsitektur</h2>
        <p className="text-xs text-slate-500">
          Konfigurasi domain produksi GitHub Pages, status Google Drive, dan keamanan database.
        </p>
      </div>

      {/* License Status Card Section */}
      <LicenseStatusCard
        license={license || null}
        userEmail={profile?.ownerEmail}
        userUid={profile?.uid}
        onRefreshLicense={onRefreshLicense || (async () => {})}
        onOpenDeveloperPanel={onOpenDeveloperPanel}
      />

      {/* GitHub Pages & URLs Section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Konfigurasi Frontend URL (GitHub Pages)</h3>
            <p className="text-xs text-slate-500">
              Single Source of Truth untuk pembentukan QR Code dan Tautan Galeri Pelanggan.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveUrls} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                FRONTEND_PUBLIC_URL (Production Domain)
              </label>
              <span className="text-[11px] font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                Single Source of Truth
              </span>
            </div>
            <input
              type="url"
              value={frontendUrl}
              onChange={(e) => setFrontendUrlState(e.target.value)}
              placeholder="https://username.github.io/GaleriFotoQR-Cloud"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              Masukkan URL hosting frontend produksi (misal GitHub Pages: <code>https://username.github.io/GaleriFotoQR-Cloud</code> atau custom domain). Semua QR Code dan tautan pelanggan otomatis dibentuk dari URL ini.
            </p>

            {/* Live URL Preview */}
            <div className="mt-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                Contoh Hasil Tautan Pelanggan & QR Code:
              </span>
              <p className="font-mono text-slate-800 text-[11px] break-all bg-white p-2 rounded-lg border border-slate-200">
                {frontendUrl && frontendUrl.trim() !== ''
                  ? `${frontendUrl.trim().replace(/\/+$/, '')}/#/gallery/GFQ-SAMPLE`
                  : `${getFrontendPublicUrl()}/#/gallery/GFQ-SAMPLE`}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              API_BASE_URL (Opsional / Backend Cloud Run)
            </label>
            <input
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrlState(e.target.value)}
              placeholder="https://api-service.asia-southeast1.run.app (jika ada backend terpisah)"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              Simpan Konfigurasi URL
            </button>

            {saveSuccess && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                <Check className="w-4 h-4" /> Tersimpan!
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Google Drive Status Section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Penyimpanan Google Drive</h3>
            <p className="text-xs text-slate-500">Struktur folder dan kuota foto studio</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Folder Utama di Drive</span>
            <p className="text-sm font-bold text-slate-800">{DEFAULT_ROOT_FOLDER_NAME}</p>
            <p className="text-[11px] text-slate-400">ID: {profile?.driveRootFolderId || 'Dibuat otomatis saat upload'}</p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status & Kuota</span>
            <p className="text-sm font-bold text-slate-800">
              {isDriveConnected ? '🟢 Terhubung' : '🔴 Belum Terhubung'}
            </p>
            <p className="text-[11px] text-slate-500">
              Terpakai: {quota ? formatBytes(quota.usage) : '0 GB'} / {quota && quota.limit > 0 ? formatBytes(quota.limit) : '15 GB'}
            </p>
          </div>
        </div>

        {!isDriveConnected && (
          <button
            onClick={onConnectDrive}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
          >
            Hubungkan Google Drive
          </button>
        )}
      </div>

      {/* Database & Data Sovereignty Section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Database & Kedaulatan Data Studio</h3>
            <p className="text-xs text-slate-500">
              Data album dan metadata tersinkronisasi ganda (Firestore Cloud + Local Cache) sehingga album tidak akan hilang.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleExportBackup}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            Ekspor Cadangan Data (.JSON)
          </button>

          <button
            onClick={onRefreshData}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Sinkronkan Ulang Database
          </button>
        </div>
      </div>
    </div>
  );
};
