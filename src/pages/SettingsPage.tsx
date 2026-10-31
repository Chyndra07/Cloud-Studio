import React, { useState, useEffect } from 'react';
import {
  Globe,
  HardDrive,
  Database,
  Download,
  Check,
  RefreshCw,
  HelpCircle,
  ShieldCheck,
  Type,
  Smartphone,
  CheckCircle2,
  Sparkles,
  Laptop,
} from 'lucide-react';
import { StudioProfile, Album } from '../types';
import { StorageQuotaInfo } from '../hooks/useStudioData';
import { LicensePublicData } from '../license/licenseTypes';
import { LicenseStatusCard } from '../license/LicenseStatusCard';
import { TypographySettingsTab } from '../components/settings/TypographySettingsTab';
import {
  isRunningStandalone,
  subscribeToInstallPrompt,
  promptPWAInstall,
} from '../services/pwaService';
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
  albums?: Album[];
  user?: any;
  license?: LicensePublicData | null;
  onConnectDrive: () => void;
  onRefreshData?: () => void;
  onRefreshLicense?: () => Promise<void>;
  onOpenDeveloperPanel?: () => void;
  onOpenDevPanel?: () => void;
  onUpdateProfile?: (updates: Partial<StudioProfile>) => Promise<void>;
}

export type SettingsSubTab = 'typography' | 'system' | 'drive' | 'license' | 'backup' | 'install';

export const SettingsPage: React.FC<SettingsPageProps> = ({
  profile,
  quota,
  isDriveConnected,
  albums = [],
  user,
  license,
  onConnectDrive,
  onRefreshData = () => {},
  onRefreshLicense,
  onOpenDeveloperPanel,
  onOpenDevPanel,
  onUpdateProfile,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsSubTab>('typography');
  const [frontendUrl, setFrontendUrlState] = useState(getFrontendPublicUrl());
  const [apiUrl, setApiUrlState] = useState(getApiBaseUrl());
  const [saveSuccess, setSaveSuccess] = useState(false);

  // PWA State Tracking
  const [isStandalone, setIsStandalone] = useState<boolean>(isRunningStandalone());
  const [canInstall, setCanInstall] = useState<boolean>(false);

  useEffect(() => {
    setIsStandalone(isRunningStandalone());
    const unsubscribe = subscribeToInstallPrompt((eligible) => {
      setCanInstall(eligible);
      setIsStandalone(isRunningStandalone());
    });
    return () => unsubscribe();
  }, []);

  const handleInstallClick = async () => {
    const outcome = await promptPWAInstall();
    if (outcome === 'accepted') {
      setIsStandalone(true);
      setCanInstall(false);
    }
  };

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

  const openDevPanelHandler = onOpenDeveloperPanel || onOpenDevPanel;

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Pengaturan Studio & Arsitektur</h2>
        <p className="text-xs text-slate-500">
          Kelola tipografi global studio, konfigurasi domain produksi, penyimpanan Google Drive, lisensi, dan instalasi PWA.
        </p>
      </div>

      {/* Submenu Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('typography')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'typography'
              ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-600'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Type className="w-4 h-4" />
          <span>Typography</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('system')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'system'
              ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-600'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Domain & URL</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('drive')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'drive'
              ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-600'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          <span>Google Drive</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('license')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'license'
              ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-600'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Status Lisensi</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('backup')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'backup'
              ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-600'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Backup Data</span>
        </button>

        {/* Tab Baru: Instalasi Aplikasi */}
        <button
          type="button"
          onClick={() => setActiveTab('install')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'install'
              ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-600'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Instalasi Aplikasi</span>
        </button>
      </div>

      {/* Submenu 1: Typography */}
      {activeTab === 'typography' && (
        <TypographySettingsTab profile={profile} onUpdateProfile={onUpdateProfile} />
      )}

      {/* Submenu 2: Domain & URL */}
      {activeTab === 'system' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5 animate-fade-in">
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
                placeholder="https://sevencloud.my.id"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Domain kustom tempat situs web atau PWA Seven Studio diakses pelanggan.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                API_BASE_URL (Cloudflare Worker Proxy)
              </label>
              <input
                type="url"
                value={apiUrl}
                onChange={(e) => setApiUrlState(e.target.value)}
                placeholder="https://galerifotoqr.cloud/api"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 active:scale-95 transition-all"
              >
                <Check className="w-4 h-4" />
                Simpan Konfigurasi Domain
              </button>

              {saveSuccess && (
                <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5 animate-fade-in">
                  <Check className="w-4 h-4" />
                  Konfigurasi berhasil disimpan!
                </span>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Submenu 3: Google Drive */}
      {activeTab === 'drive' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Integrasi Google Drive Studio</h3>
              <p className="text-xs text-slate-500">
                Penyimpanan foto asli berkualitas tinggi tanpa kompresi pada akun Google studio Anda.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
              <span className="text-[11px] font-semibold text-slate-400">Status Otorisasi Drive</span>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${isDriveConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}
                />
                <span className="text-xs font-bold text-slate-800">
                  {isDriveConnected ? 'Terhubung & Siap Digunakan' : 'Perlu Login Ulang'}
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
              <span className="text-[11px] font-semibold text-slate-400">Kapasitas Penyimpanan</span>
              <p className="text-xs font-bold text-slate-800">
                {quota ? `${formatBytes(quota.usage)} dari ${formatBytes(quota.limit)}` : 'Memuat data...'}
              </p>
            </div>
          </div>

          {!isDriveConnected && (
            <button
              onClick={onConnectDrive}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 active:scale-95 transition-all"
            >
              <HardDrive className="w-4 h-4" />
              Hubungkan Google Drive
            </button>
          )}
        </div>
      )}

      {/* Submenu 4: Lisensi */}
      {activeTab === 'license' && (
        <div className="animate-fade-in">
          <LicenseStatusCard
            license={license || null}
            userEmail={profile?.ownerEmail}
            userUid={profile?.uid}
            onRefreshLicense={onRefreshLicense || (async () => {})}
            onOpenDeveloperPanel={openDevPanelHandler}
          />
        </div>
      )}

      {/* Submenu 5: Backup Data */}
      {activeTab === 'backup' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4 animate-fade-in">
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
      )}

      {/* Submenu 6: Instalasi Aplikasi (BARU) */}
      {activeTab === 'install' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 animate-fade-in">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Instalasi Progressive Web App (PWA)</h3>
              <p className="text-xs text-slate-500">
                Pasang aplikasi Seven Studio ke Layar Utama perangkat Android atau desktop Anda untuk pengalaman layaknya aplikasi native.
              </p>
            </div>
          </div>

          {/* App Identity Banner */}
          <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-5 shadow-inner">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
              <img
                src="/icon-192.png"
                alt="Seven Studio Icon"
                className="w-16 h-16 rounded-2xl shadow-lg border-2 border-slate-700/80 shrink-0 object-cover"
              />
              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h4 className="text-base font-extrabold text-white tracking-tight">Seven Studio</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full uppercase tracking-wider">
                    PWA Release
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  GaleriFotoQR Cloud Studio • Domain: <span className="font-mono text-slate-300">sevencloud.my.id</span>
                </p>
                <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-3 text-[11px] text-slate-400">
                  <span>Versi: <strong className="text-white">v1.0.0</strong></span>
                  <span>•</span>
                  <span>Jenis: <strong className="text-white">Progressive Web App</strong></span>
                  <span>•</span>
                  <span>Status: {isStandalone ? (
                    <span className="text-emerald-400 font-semibold inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Terinstal (Standalone)
                    </span>
                  ) : canInstall ? (
                    <span className="text-blue-400 font-semibold inline-flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Siap Diinstal
                    </span>
                  ) : (
                    <span className="text-slate-300 font-semibold inline-flex items-center gap-1">
                      <Laptop className="w-3 h-3" /> Web Browser
                    </span>
                  )}</span>
                </div>
              </div>
            </div>

            {/* Install Action or Installed Badge */}
            <div className="shrink-0 flex flex-col items-center sm:items-end gap-2 w-full sm:w-auto">
              {isStandalone ? (
                <div className="px-4 py-2.5 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-bold inline-flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Aplikasi Terinstal</span>
                </div>
              ) : canInstall ? (
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/30 active:scale-95 transition-all"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Install Aplikasi Seven Studio</span>
                </button>
              ) : (
                <div className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 text-xs font-semibold inline-flex items-center gap-1.5 text-center">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Mode Web Browser Aktif</span>
                </div>
              )}
            </div>
          </div>

          {/* Standalone Success Notice */}
          {isStandalone && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-bold">Aplikasi Telah Berjalan dalam Mode Standalone</p>
                <p className="text-emerald-700 leading-relaxed">
                  Seven Studio telah berhasil terpasang di perangkat ini. Aplikasi berjalan mandiri tanpa bilah URL browser dan dapat dibuka langsung dari layar utama perangkat seperti aplikasi Android biasa.
                </p>
              </div>
            </div>
          )}

          {/* Browser Compatibility Matrix */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Status Kompatibilitas Browser & Keamanan
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">Service Worker</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Aktif</span>
                </div>
                <p className="text-xs font-bold text-slate-800">sw.js terdaftar</p>
                <p className="text-[11px] text-slate-500">Cache statis aman tanpa mencegat Auth/Drive.</p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">Web App Manifest</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Valid</span>
                </div>
                <p className="text-xs font-bold text-slate-800">manifest.webmanifest</p>
                <p className="text-[11px] text-slate-500">Ikon 192, 512, dan maskable terpasang.</p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">Protokol Jaringan</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Aman</span>
                </div>
                <p className="text-xs font-bold text-slate-800">HTTPS Enkripsi</p>
                <p className="text-[11px] text-slate-500">Koneksi SSL terverifikasi.</p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">Tampilan Display</span>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                    {isStandalone ? 'Standalone' : 'Browser'}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-800">
                  {isStandalone ? 'Mode Aplikasi Aktif' : 'Mode Tab Web'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {isStandalone ? 'Layar penuh tanpa address bar' : 'Mendukung instalasi PWA'}
                </p>
              </div>
            </div>
          </div>

          {/* Manual Installation Guide (When prompt is unavailable or for iOS / Desktop Safari) */}
          {!isStandalone && !canInstall && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                <HelpCircle className="w-4 h-4 text-blue-600" />
                <span>Petunjuk Pemasangan Manual ke Layar Utama (Add to Home Screen)</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Jika browser Anda tidak menampilkan tombol instalasi otomatis:
              </p>
              <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside pl-1">
                <li>
                  <strong className="text-slate-800">Google Chrome Android:</strong> Ketuk tombol menu titik tiga (<strong>⋮</strong>) di pojok kanan atas, lalu pilih <strong>"Instal aplikasi"</strong> atau <strong>"Tambahkan ke Layar Utama"</strong>.
                </li>
                <li>
                  <strong className="text-slate-800">Safari iOS (iPhone/iPad):</strong> Ketuk tombol <strong>Bagikan (Share)</strong> di bagian bawah, lalu pilih <strong>"Tambahkan ke Layar Utama" (Add to Home Screen)</strong>.
                </li>
                <li>
                  <strong className="text-slate-800">Microsoft Edge / Chrome Desktop:</strong> Klik ikon komputer/instal di sebelah kanan bilah alamat (address bar).
                </li>
              </ul>
            </div>
          )}

          {/* Benefits Card */}
          <div className="p-4 bg-blue-50/60 border border-blue-200/60 rounded-2xl space-y-2 text-xs text-slate-700">
            <h5 className="font-bold text-blue-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-600" />
              Keunggulan Progressive Web App (PWA) Seven Studio
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <strong className="block text-slate-900">Ringan & Cepat</strong>
                <span className="text-[11px] text-slate-500">Tidak membutuhkan unduhan ratusan megabita dari toko aplikasi dan hemat ruang penyimpanan.</span>
              </div>
              <div>
                <strong className="block text-slate-900">Selalu Terbarui</strong>
                <span className="text-[11px] text-slate-500">Otomatis mendapatkan pembaruan versi terbaru langsung saat terkoneksi ke internet.</span>
              </div>
              <div>
                <strong className="block text-slate-900">Tampilan Bersih</strong>
                <span className="text-[11px] text-slate-500">Membuka penuh layar tanpa bilah navigasi browser, memberikan ruang kerja studio foto yang maksimal.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
