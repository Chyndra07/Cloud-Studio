import React from 'react';
import { Calendar, Clock, AlertCircle } from 'lucide-react';

export interface ExpirySettingsState {
  isExpiryEnabled: boolean;
  expiresAt: string; // YYYY-MM-DDTHH:mm (local datetime string)
  expiryAction: 'disable' | 'trash';
}

interface AlbumExpirySettingsProps {
  isExpiryEnabled: boolean;
  expiresAt: string;
  expiryAction: 'disable' | 'trash';
  onChange: (updates: Partial<ExpirySettingsState>) => void;
  compact?: boolean;
}

/**
 * Format a Date object to YYYY-MM-DDTHH:mm in local time
 */
export const formatLocalDateTime = (date: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Calculate datetime after N days preserving hours and minutes
 */
export const calculateExpiryPreset = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatLocalDateTime(d);
};

export const AlbumExpirySettings: React.FC<AlbumExpirySettingsProps> = ({
  isExpiryEnabled,
  expiresAt,
  expiryAction,
  onChange,
  compact = false,
}) => {
  const handleToggle = (checked: boolean) => {
    if (checked && !expiresAt) {
      onChange({
        isExpiryEnabled: true,
        expiresAt: calculateExpiryPreset(30),
      });
    } else {
      onChange({ isExpiryEnabled: checked });
    }
  };

  const handleApplyPreset = (days: number) => {
    onChange({
      isExpiryEnabled: true,
      expiresAt: calculateExpiryPreset(days),
    });
  };

  return (
    <div className="space-y-3">
      {/* Toggle Container Card */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-700 shrink-0" />
              <label 
                htmlFor="toggle-expiry-settings" 
                className="text-xs font-bold text-slate-900 cursor-pointer flex items-center gap-1.5"
              >
                <span>Masa Berlaku Galeri (Opsional)</span>
                {isExpiryEnabled ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                    Aktif
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-600">
                    Nonaktif
                  </span>
                )}
              </label>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed pl-6">
              Tentukan batas waktu akses online bagi pelanggan. Setelah masa berlaku habis, sistem akan menjalankan tindakan yang dipilih.
            </p>
          </div>

          {/* Toggle Switch */}
          <button
            type="button"
            id="toggle-expiry-settings"
            role="switch"
            aria-checked={isExpiryEnabled}
            onClick={() => handleToggle(!isExpiryEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isExpiryEnabled ? 'bg-blue-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isExpiryEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Expanded Expiry Details */}
        {isExpiryEnabled ? (
          <div className="pt-3 border-t border-slate-200/70 space-y-3.5 animate-in fade-in duration-150">
            {/* Input Tanggal & Waktu Berakhir */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Tanggal & Waktu Berakhir</span>
              </label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => onChange({ expiresAt: e.target.value })}
                required={isExpiryEnabled}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition shadow-2xs font-medium"
              />
            </div>

            {/* Preset Cepat */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-600 block">
                Preset Cepat:
              </span>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyPreset(7)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs hover:border-slate-400 transition cursor-pointer active:scale-95 shrink-0"
                >
                  +7 Hari
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(14)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs hover:border-slate-400 transition cursor-pointer active:scale-95 shrink-0"
                >
                  +14 Hari
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(30)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs hover:border-slate-400 transition cursor-pointer active:scale-95 shrink-0"
                >
                  +30 Hari
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(90)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs hover:border-slate-400 transition cursor-pointer active:scale-95 shrink-0"
                >
                  +90 Hari (3 Bulan)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(365)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs hover:border-slate-400 transition cursor-pointer active:scale-95 shrink-0"
                >
                  +1 Tahun
                </button>
              </div>
            </div>

            {/* Tindakan Otomatis Saat Masa Berlaku Habis */}
            <div className="pt-2 border-t border-slate-200/70 space-y-2">
              <label className="block text-[11px] font-bold text-slate-700">
                Tindakan Otomatis Saat Masa Berlaku Habis:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Option 1: Nonaktifkan Akses Saja (DEFAULT) */}
                <label
                  className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                    expiryAction === 'disable'
                      ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 text-slate-900 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="expiryActionOption"
                    value="disable"
                    checked={expiryAction === 'disable'}
                    onChange={() => onChange({ expiryAction: 'disable' })}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="text-xs space-y-0.5">
                    <span className="font-bold text-slate-900 block">Nonaktifkan Akses Saja</span>
                    <span className="text-[11px] text-slate-500 block leading-tight">
                      Tampilkan pesan masa aktif habis dan tombol kontak studio. Album, folder, foto, dan file Google Drive tetap tersimpan dan tidak dihapus.
                    </span>
                  </div>
                </label>

                {/* Option 2: Pindahkan ke Sampah */}
                <label
                  className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                    expiryAction === 'trash'
                      ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 text-slate-900 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="expiryActionOption"
                    value="trash"
                    checked={expiryAction === 'trash'}
                    onChange={() => onChange({ expiryAction: 'trash' })}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="text-xs space-y-0.5">
                    <span className="font-bold text-slate-900 block">Pindahkan ke Sampah</span>
                    <span className="text-[11px] text-slate-500 block leading-tight">
                      Otomatis tandai album nonaktif dan pindahkan ke Keranjang Sampah studio.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div className="pt-2 border-t border-slate-200/70 text-xs text-slate-500 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span>
            <span>Galeri tidak memiliki tanggal kedaluwarsa.</span>
          </div>
        )}
      </div>
    </div>
  );
};
