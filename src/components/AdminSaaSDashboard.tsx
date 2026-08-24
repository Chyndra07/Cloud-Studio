import React, { useState } from 'react';
import { 
  Building2, 
  Users, 
  ShieldCheck, 
  HardDrive, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Sparkles, 
  Zap, 
  Lock, 
  Plus, 
  RefreshCw, 
  ExternalLink, 
  Crown 
} from 'lucide-react';
import { StudioTenantRecord, UserAccount } from '../types';
import { getAllStudioTenants } from '../services/storageService';

interface AdminSaaSDashboardProps {
  currentUser: UserAccount | null;
  onSwitchStudio?: (studioUser: UserAccount) => void;
}

export const AdminSaaSDashboard: React.FC<AdminSaaSDashboardProps> = ({
  currentUser,
}) => {
  const [tenants, setTenants] = useState<StudioTenantRecord[]>(getAllStudioTenants());

  const totalStudios = tenants.length;
  const activeStudios = tenants.filter((t) => t.status === 'active').length;
  const totalAlbums = tenants.reduce((acc, t) => acc + t.activeAlbumsCount, 0);
  const totalPhotos = tenants.reduce((acc, t) => acc + t.totalPhotosCount, 0);

  const toggleTenantStatus = (tenantId: string) => {
    setTenants((prev) =>
      prev.map((t) =>
        t.id === tenantId
          ? { ...t, status: t.status === 'active' ? 'suspended' : 'active' }
          : t
      )
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-200">
      {/* SaaS Admin Banner */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 relative overflow-hidden shadow-2xs">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-xs font-bold">
              <Crown className="w-3.5 h-3.5 text-blue-600" />
              <span>Platform Owner & SaaS Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              GaleriFotoQR Multi-Tenant Cloud Control
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
              Arsitektur terpusat siap pakai. Setiap studio foto pelanggan menggunakan Google Drive dan akun Google masing-masing dengan isolasi data multi-tenant menyeluruh.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <span className="text-slate-500 block">Workspace Aktif:</span>
              <strong className="text-slate-900 font-bold block truncate max-w-[200px]">
                {currentUser?.name || 'Belum Terhubung'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* SaaS Global Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Total Studio Terdaftar
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{totalStudios}</span>
            <span className="text-xs text-emerald-600 font-bold">{activeStudios} aktif</span>
          </div>
          <p className="text-[11px] text-slate-500">Multi-tenant workspaces</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Total Album Pelanggan
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{totalAlbums}</span>
            <span className="text-xs text-slate-500 font-semibold">album</span>
          </div>
          <p className="text-[11px] text-slate-500">Terdistribusi di Drive masing-masing</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Total Foto Diunggah
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{totalPhotos}</span>
            <span className="text-xs text-slate-500 font-semibold">file gambar</span>
          </div>
          <p className="text-[11px] text-slate-500">Direct streaming via Google Drive API</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Model Bisnis SaaS
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">Siap Pakai</span>
          </div>
          <p className="text-[11px] text-slate-500">Multi-Tenant Terisolasi</p>
        </div>
      </div>

      {/* Studio Tenant Directory Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Daftar Studio Tenant (SaaS)</h3>
            <p className="text-xs text-slate-500">Daftar akun studio aktif yang terhubung pada sistem</p>
          </div>
        </div>

        {tenants.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <Building2 className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">Belum Ada Studio Terhubung</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Hubungkan akun Google Drive Anda di dashboard untuk mendaftarkan workspace studio pertama Anda.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Nama Studio & Pemilik</th>
                  <th className="py-3 px-4">Paket Langganan</th>
                  <th className="py-3 px-4">Google Drive</th>
                  <th className="py-3 px-4">Album Aktif</th>
                  <th className="py-3 px-4">Status Akun</th>
                  <th className="py-3 px-4 text-right">Kelola</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{tenant.studioName}</div>
                      <div className="text-[11px] text-slate-500">{tenant.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-100">
                        {tenant.plan}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Terhubung
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {tenant.activeAlbumsCount} album ({tenant.totalPhotosCount} foto)
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tenant.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {tenant.status === 'active' ? 'AKTIF' : 'SUSPENDED'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => toggleTenantStatus(tenant.id)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition cursor-pointer font-medium"
                      >
                        {tenant.status === 'active' ? 'Suspend' : 'Aktifkan'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
