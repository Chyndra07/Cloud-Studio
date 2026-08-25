import React, { useState } from 'react';
import {
  ShieldCheck,
  Key,
  CheckCircle2,
  Clock,
  RefreshCw,
  ExternalLink,
  Lock,
  User,
  Sparkles,
} from 'lucide-react';
import { LicensePublicData } from './licenseTypes';
import { PRODUCT_ID } from './licenseService';

interface LicenseStatusCardProps {
  license: LicensePublicData | null;
  userEmail?: string;
  userUid?: string;
  onRefreshLicense: () => Promise<void>;
  onOpenDeveloperPanel?: () => void;
}

export const LicenseStatusCard: React.FC<LicenseStatusCardProps> = ({
  license,
  userEmail,
  userUid,
  onRefreshLicense,
  onOpenDeveloperPanel,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshMessage(null);
    try {
      await onRefreshLicense();
      setRefreshMessage('Status lisensi berhasil diverifikasi ulang dengan server!');
      setTimeout(() => setRefreshMessage(null), 3500);
    } catch (err: any) {
      setRefreshMessage('Gagal memperbarui status lisensi.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const planLabel = license?.plan
    ? license.plan === 'lifetime'
      ? 'Lifetime (Permanen)'
      : license.plan === 'yearly'
      ? 'Tahunan (Yearly)'
      : license.plan === 'monthly'
      ? 'Bulanan (Monthly)'
      : 'Uji Coba (Trial)'
    : 'Aktif';

  const expiryText =
    license?.plan === 'lifetime'
      ? 'Permanen (Tanpa Batas Waktu)'
      : license?.expiresAt
      ? new Date(license.expiresAt).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : 'Tidak terbatas';

  const activatedText = license?.activatedAt
    ? new Date(license.activatedAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Telah Aktif';

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Informasi Lisensi & Hak Akses Studio</h3>
            <p className="text-xs text-slate-500">
              Status autentikasi lisensi terpusat via Cloud Validation Database.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Lisensi Aktif
          </span>
        </div>
      </div>

      {refreshMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{refreshMessage}</span>
        </div>
      )}

      {/* Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Paket Lisensi
          </span>
          <p className="text-xs font-bold text-slate-900">{planLabel}</p>
          <span className="text-[10px] text-blue-600 font-semibold">{PRODUCT_ID}</span>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Masa Berlaku
          </span>
          <p className="text-xs font-bold text-slate-900">{expiryText}</p>
          <span className="text-[10px] text-slate-500">Aktivasi: {activatedText}</span>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1 sm:col-span-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Akun Google Terikat (Single Sign-On)
          </span>
          <p className="text-xs font-bold text-slate-900 truncate">{userEmail || license?.email || 'Akun Google Studio'}</p>
          <p className="text-[10px] font-mono text-slate-400 truncate">UID: {userUid || license?.googleUid}</p>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Memverifikasi...' : 'Verifikasi Ulang Status Lisensi'}</span>
        </button>

        {onOpenDeveloperPanel && (
          <button
            onClick={onOpenDeveloperPanel}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-all"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Developer License Admin Panel</span>
          </button>
        )}
      </div>
    </div>
  );
};
