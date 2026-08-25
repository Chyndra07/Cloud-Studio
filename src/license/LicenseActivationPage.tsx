import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  Key,
  Camera,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  LogOut,
  Sparkles,
  HelpCircle,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { activateLicense, PRODUCT_ID } from './licenseService';
import { LicensePublicData } from './licenseTypes';

interface LicenseActivationPageProps {
  user: User;
  onActivated: (license: LicensePublicData) => void;
  onSignOut: () => void;
  onRefreshCheck: () => void;
  onOpenDeveloperPanel?: () => void;
}

export const LicenseActivationPage: React.FC<LicenseActivationPageProps> = ({
  user,
  onActivated,
  onSignOut,
  onRefreshCheck,
  onOpenDeveloperPanel,
}) => {
  const [licenseKey, setLicenseKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const demoKeys = [
    { key: 'GFQ-DEMO-LIFE-2026', label: 'Lifetime Demo', plan: 'Lifetime' },
    { key: 'GFQ-DEMO-YEAR-2026', label: '1 Tahun Demo', plan: 'Tahunan' },
    { key: 'GFQ-DEMO-MNTH-2026', label: '1 Bulan Demo', plan: 'Bulanan' },
    { key: 'GFQ-DEMO-TRIL-2026', label: '14 Hari Trial', plan: 'Trial' },
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase();
    // Auto format uppercase
    setLicenseKey(val);
    if (error) setError(null);
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim()) {
      setError('Harap masukkan Kode Lisensi resmi Anda.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await activateLicense(user, licenseKey);
      if (res.valid && res.license) {
        onActivated(res.license);
      } else {
        setError(res.errorMessage || 'Gagal mengaktifkan lisensi. Periksa kembali kode lisensi Anda.');
      }
    } catch (err: any) {
      setError(err?.message || 'Terjadi gangguan koneksi ke server aktivasi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setLicenseKey(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const whatsappMessage = encodeURIComponent(
    `Halo Admin GaleriFotoQR, saya ingin membeli/mengaktifkan lisensi aplikasi untuk akun Google: ${user.email} (UID: ${user.uid}). Mohon bantuan kode lisensi resmi.`
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-blue-500 selection:text-white p-4 sm:p-6">
      {/* Top Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4 border-b border-slate-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white tracking-tight">GaleriFotoQR</h1>
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block">
              License & Activation Center
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenDeveloperPanel && (
            <button
              onClick={onOpenDeveloperPanel}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-all"
            >
              Developer Panel
            </button>
          )}

          <button
            onClick={onSignOut}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-semibold transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar Akun</span>
          </button>
        </div>
      </header>

      {/* Main Activation Card */}
      <main className="max-w-xl mx-auto w-full my-auto py-8">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Card Title & Icon */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto shadow-inner">
              <Key className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">Aktivasi Lisensi Aplikasi</h2>
            <p className="text-xs text-slate-400">
              Selamat datang! Masukkan Kode Lisensi resmi untuk mengaktifkan akun Google Studio Anda.
            </p>
          </div>

          {/* User Profile Card */}
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-11 h-11 rounded-full border border-slate-700 object-cover shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {user.email?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{user.displayName || 'Pengguna Google'}</p>
                <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                <span className="inline-block mt-0.5 text-[9px] font-mono text-slate-500 truncate max-w-[200px]">
                  UID: {user.uid}
                </span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-[10px] font-bold block">
                Belum Aktif
              </span>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-start gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold">Aktivasi Gagal</p>
                <p className="text-[11px] text-rose-200 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* Form Activation */}
          <form onSubmit={handleActivate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Kode Lisensi / Aktivasi
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={licenseKey}
                  onChange={handleInputChange}
                  placeholder="GFQ-XXXX-XXXX-XXXX"
                  className="w-full px-4 py-3.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-2xl text-sm font-mono tracking-widest text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-center uppercase"
                  autoComplete="off"
                  spellCheck="false"
                  disabled={isSubmitting}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 text-center">
                Product ID: <code className="text-slate-400">{PRODUCT_ID}</code> • Lisensi akan diikat ke akun Google di atas.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !licenseKey.trim()}
              className="w-full py-3.5 px-6 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-2xl text-xs font-bold shadow-xl shadow-blue-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Memverifikasi Lisensi ke Server...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>AKTIFKAN APLIKASI SEKARANG</span>
                </>
              )}
            </button>
          </form>

          {/* Ready Starter / Demo Keys Section for Quick Testing */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Kunci Demo / Siap Pakai:
              </span>
              <button
                type="button"
                onClick={onRefreshCheck}
                className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Cek Status Ulang
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {demoKeys.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleCopyKey(item.key)}
                  className="p-2.5 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition-all group flex items-center justify-between"
                >
                  <div>
                    <p className="text-[10px] font-mono font-bold text-slate-300 group-hover:text-blue-400">
                      {item.key}
                    </p>
                    <span className="text-[9px] text-slate-500">{item.plan}</span>
                  </div>
                  {copiedKey === item.key ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Seller Contact & Help */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 border-t border-slate-800/80">
            <span>Belum memiliki Kode Lisensi?</span>
            <a
              href={`https://wa.me/6281234567890?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl font-bold transition-all"
            >
              <span>Hubungi Penjual (WhatsApp)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto w-full text-center py-4 border-t border-slate-900 text-xs text-slate-600">
        GaleriFotoQR Cloud Studio • Sistem Lisensi & Validasi Terpusat • Data Google Drive Milik Pengguna
      </footer>
    </div>
  );
};
