import React, { useState, useEffect } from 'react';
import {
  Shield,
  Key,
  Plus,
  RefreshCw,
  Search,
  Check,
  Copy,
  AlertCircle,
  Clock,
  Ban,
  AlertOctagon,
  UserCheck,
  Calendar,
  X,
  Lock,
  Unlock,
} from 'lucide-react';
import {
  fetchAdminLicenses,
  createAdminLicense,
  updateAdminLicense,
} from './licenseService';
import { LicenseAdminItem, LicensePlan, LicenseStatus } from './licenseTypes';

interface DeveloperLicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeveloperLicenseModal: React.FC<DeveloperLicenseModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [adminKey, setAdminKey] = useState<string>('developer');
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [licenses, setLicenses] = useState<LicenseAdminItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form State for creating new license
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [newPlan, setNewPlan] = useState<LicensePlan>('lifetime');
  const [newCustomerName, setNewCustomerName] = useState<string>('');
  const [newCustomKey, setNewCustomKey] = useState<string>('');
  const [newExpiresInDays, setNewExpiresInDays] = useState<string>('365');
  const [newNotes, setNewNotes] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && isUnlocked) {
      loadLicenses();
    }
  }, [isOpen, isUnlocked]);

  const loadLicenses = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchAdminLicenses(adminKey);
      if (res.success) {
        setLicenses(res.licenses);
        setIsUnlocked(true);
      } else {
        setError(res.error || 'Password Developer Salah');
        setIsUnlocked(false);
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal terhubung ke API Developer.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    loadLicenses();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);
    try {
      const res = await createAdminLicense(adminKey, {
        key: newCustomKey.trim() || undefined,
        plan: newPlan,
        customerName: newCustomerName.trim() || undefined,
        expiresInDays: newPlan !== 'lifetime' && newExpiresInDays ? parseInt(newExpiresInDays, 10) : undefined,
        notes: newNotes.trim() || undefined,
      });

      if (res.success && res.license) {
        setShowCreateForm(false);
        setNewCustomerName('');
        setNewCustomKey('');
        setNewNotes('');
        await loadLicenses();
      } else {
        setError(res.error || 'Gagal membuat lisensi.');
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal membuat lisensi.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateStatus = async (licenseId: string, status: LicenseStatus) => {
    try {
      await updateAdminLicense(adminKey, { licenseId, status });
      await loadLicenses();
    } catch (err: any) {
      setError(err?.message || 'Gagal mengubah status');
    }
  };

  const handleExtendDays = async (licenseId: string, days: number) => {
    try {
      await updateAdminLicense(adminKey, { licenseId, extendDays: days });
      await loadLicenses();
    } catch (err: any) {
      setError(err?.message || 'Gagal menambah masa aktif');
    }
  };

  const handleUnbindUid = async (licenseId: string) => {
    if (!window.confirm('Lepas ikatan akun Google dari lisensi ini?')) return;
    try {
      await updateAdminLicense(adminKey, { licenseId, unbindUid: true });
      await loadLicenses();
    } catch (err: any) {
      setError(err?.message || 'Gagal melepas akun');
    }
  };

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (!isOpen) return null;

  const filteredLicenses = licenses.filter((l) => {
    const q = searchQuery.toLowerCase();
    return (
      l.licenseKey.toLowerCase().includes(q) ||
      (l.customerName && l.customerName.toLowerCase().includes(q)) ||
      (l.email && l.email.toLowerCase().includes(q)) ||
      (l.googleUid && l.googleUid.toLowerCase().includes(q)) ||
      l.plan.toLowerCase().includes(q) ||
      l.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Developer License Management</h3>
              <p className="text-xs text-slate-400">Pusat Penerbitan & Pengendalian Lisensi Komersial GaleriFotoQR</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {!isUnlocked ? (
          <div className="p-8 max-w-md mx-auto w-full text-center space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <Lock className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">Otentikasi Developer Diperlukan</h4>
              <p className="text-xs text-slate-400">
                Masukkan developer secret key untuk mengakses panel pembuatan & manajemen lisensi.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleUnlock} className="space-y-3">
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Developer Secret / Password"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all"
              >
                {isLoading ? 'Memeriksa...' : 'Buka License Manager'}
              </button>
            </form>
            <p className="text-[10px] text-slate-500">Default Key: <code>developer</code> atau <code>admin123</code></p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari License Key, email, UID, nama pembeli, status..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buat Lisensi Baru</span>
                </button>

                <button
                  onClick={loadLicenses}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
                  title="Segarkan data"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Create New License Form Modal / Inset */}
            {showCreateForm && (
              <form
                onSubmit={handleCreate}
                className="p-5 bg-slate-950 border border-purple-500/30 rounded-2xl space-y-4 animate-fadeIn"
              >
                <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Key className="w-4 h-4" /> Terbitkan Kode Lisensi Baru
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Paket / Plan</label>
                    <select
                      value={newPlan}
                      onChange={(e) => setNewPlan(e.target.value as LicensePlan)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                    >
                      <option value="lifetime">Lifetime (Permanen)</option>
                      <option value="yearly">Tahunan (Yearly)</option>
                      <option value="monthly">Bulanan (Monthly)</option>
                      <option value="trial">Trial (14 Hari)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Nama Pembeli / Studio</label>
                    <input
                      type="text"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder="Contoh: Prima Photo Studio"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Custom Key (Kosongkan utk Auto-Random)
                    </label>
                    <input
                      type="text"
                      value={newCustomKey}
                      onChange={(e) => setNewCustomKey(e.target.value.toUpperCase())}
                      placeholder="GFQ-XXXX-XXXX-XXXX"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-white uppercase"
                    />
                  </div>
                </div>

                {newPlan !== 'lifetime' && (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Masa Berlaku (Hari)</label>
                    <input
                      type="number"
                      value={newExpiresInDays}
                      onChange={(e) => setNewExpiresInDays(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Catatan Internal / Transaksi</label>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Contoh: Pembayaran transfer BCA Order #991"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold"
                  >
                    {isCreating ? 'Menerbitkan...' : 'Generate & Simpan'}
                  </button>
                </div>
              </form>
            )}

            {/* Licenses Table / List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-2">
                <span>Daftar Lisensi ({filteredLicenses.length})</span>
                <span>Status & Tindakan</span>
              </div>

              {filteredLicenses.length === 0 ? (
                <div className="text-center py-12 bg-slate-950/40 border border-slate-800 rounded-2xl text-slate-500 text-xs">
                  Tidak ada lisensi yang cocok dengan filter.
                </div>
              ) : (
                filteredLicenses.map((lic) => {
                  const isBound = Boolean(lic.googleUid);
                  return (
                    <div
                      key={lic.licenseId}
                      className="p-4 bg-slate-950 border border-slate-800/80 rounded-2xl space-y-3 hover:border-slate-700 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        {/* Key & Copy */}
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-white bg-slate-900 px-3 py-1 rounded-xl border border-slate-800">
                            {lic.licenseKey}
                          </span>
                          <button
                            onClick={() => handleCopy(lic.licenseKey)}
                            className="p-1.5 text-slate-400 hover:text-white bg-slate-900 rounded-lg hover:bg-slate-800"
                            title="Salin Key"
                          >
                            {copiedKey === lic.licenseKey ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              lic.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : lic.status === 'pending'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : lic.status === 'expired'
                                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {lic.status}
                          </span>

                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-md text-[10px] font-semibold uppercase">
                            {lic.plan}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {lic.status !== 'active' && (
                            <button
                              onClick={() => handleUpdateStatus(lic.licenseId, 'active')}
                              className="px-2.5 py-1 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 rounded-lg text-[10px] font-bold"
                            >
                              Aktifkan
                            </button>
                          )}
                          {lic.status !== 'suspended' && (
                            <button
                              onClick={() => handleUpdateStatus(lic.licenseId, 'suspended')}
                              className="px-2.5 py-1 bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 rounded-lg text-[10px] font-bold"
                            >
                              Suspend
                            </button>
                          )}
                          {lic.status !== 'disabled' && (
                            <button
                              onClick={() => handleUpdateStatus(lic.licenseId, 'disabled')}
                              className="px-2.5 py-1 bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 rounded-lg text-[10px] font-bold"
                            >
                              Disable
                            </button>
                          )}
                          {lic.plan !== 'lifetime' && (
                            <button
                              onClick={() => handleExtendDays(lic.licenseId, 30)}
                              className="px-2.5 py-1 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-lg text-[10px] font-bold"
                              title="Tambah masa aktif 30 hari"
                            >
                              +30 Hari
                            </button>
                          )}
                          {isBound && (
                            <button
                              onClick={() => handleUnbindUid(lic.licenseId)}
                              className="px-2.5 py-1 bg-slate-800 text-slate-400 hover:text-white rounded-lg text-[10px]"
                              title="Lepas akun Google yang terikat"
                            >
                              Reset Binding
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Details row */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-400 bg-slate-900/50 p-2.5 rounded-xl">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Pembeli / Info:</span>
                          <span className="text-white font-medium">{lic.customerName || 'Belum Terdaftar'}</span>
                          {lic.notes && <p className="text-[10px] text-slate-400 italic">"{lic.notes}"</p>}
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 block">Akun Google Terikat:</span>
                          {lic.email ? (
                            <span className="text-blue-400 font-mono text-[11px] truncate block">
                              {lic.email}
                            </span>
                          ) : (
                            <span className="text-amber-400/80 text-[11px]">Belum diaktivasi (Pending)</span>
                          )}
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 block">Masa Berlaku / Expired:</span>
                          <span className="text-slate-300 font-mono text-[11px]">
                            {lic.plan === 'lifetime'
                              ? 'Permanen (Lifetime)'
                              : lic.expiresAt
                              ? new Date(lic.expiresAt).toLocaleDateString('id-ID')
                              : 'Saat Diaktivasi'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
