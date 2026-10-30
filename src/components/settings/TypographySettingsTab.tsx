import React, { useState, useEffect } from 'react';
import {
  Type,
  Check,
  RotateCcw,
  Sparkles,
  Sliders,
  Eye,
  Heart,
  Download,
  Phone,
  Shield,
  Layers,
  Info,
} from 'lucide-react';
import { FontFamilyType, FontSizeScale, StudioProfile } from '../../types';
import {
  FONT_FAMILY_OPTIONS,
  FONT_SIZE_OPTIONS,
  applyTypography,
  resetTypography,
  getFontSizePx,
  getFontStack,
  DEFAULT_TYPOGRAPHY,
} from '../../services/typographyService';

interface TypographySettingsTabProps {
  profile: StudioProfile | null;
  onUpdateProfile?: (updates: Partial<StudioProfile>) => Promise<void>;
}

export const TypographySettingsTab: React.FC<TypographySettingsTabProps> = ({
  profile,
  onUpdateProfile,
}) => {
  const initialFamily: FontFamilyType =
    profile?.typography?.fontFamily || profile?.fontFamily || DEFAULT_TYPOGRAPHY.fontFamily;
  const initialSize: FontSizeScale =
    profile?.typography?.fontSize || profile?.fontSize || DEFAULT_TYPOGRAPHY.fontSize;

  const [selectedFontFamily, setSelectedFontFamily] = useState<FontFamilyType>(initialFamily);
  const [selectedFontSize, setSelectedFontSize] = useState<FontSizeScale>(initialSize);
  const [autoSave, setAutoSave] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Sync if profile changes externally
  useEffect(() => {
    if (profile?.typography) {
      setSelectedFontFamily(profile.typography.fontFamily);
      setSelectedFontSize(profile.typography.fontSize);
    } else if (profile?.fontFamily || profile?.fontSize) {
      if (profile.fontFamily) setSelectedFontFamily(profile.fontFamily);
      if (profile.fontSize) setSelectedFontSize(profile.fontSize);
    }
  }, [profile?.typography, profile?.fontFamily, profile?.fontSize]);

  const saveTypographyToDatabase = async (family: FontFamilyType, size: FontSizeScale) => {
    if (!onUpdateProfile) return;
    setIsSaving(true);
    try {
      await onUpdateProfile({
        typography: { fontFamily: family, fontSize: size },
        fontFamily: family,
        fontSize: size,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('[TYPOGRAPHY] Failed to save typography preference:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectFont = (family: FontFamilyType) => {
    setSelectedFontFamily(family);
    applyTypography({ fontFamily: family, fontSize: selectedFontSize });
    if (autoSave) {
      saveTypographyToDatabase(family, selectedFontSize);
    }
  };

  const handleSelectSize = (size: FontSizeScale) => {
    setSelectedFontSize(size);
    applyTypography({ fontFamily: selectedFontFamily, fontSize: size });
    if (autoSave) {
      saveTypographyToDatabase(selectedFontFamily, size);
    }
  };

  const handleManualSave = () => {
    saveTypographyToDatabase(selectedFontFamily, selectedFontSize);
  };

  const handleReset = () => {
    const defFamily = DEFAULT_TYPOGRAPHY.fontFamily;
    const defSize = DEFAULT_TYPOGRAPHY.fontSize;
    setSelectedFontFamily(defFamily);
    setSelectedFontSize(defSize);
    resetTypography();
    saveTypographyToDatabase(defFamily, defSize);
  };

  const currentPx = getFontSizePx(selectedFontSize);
  const currentStack = getFontStack(selectedFontFamily);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-blue-200 border border-white/10">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Sistem Tipografi Global Studio</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Pengaturan Font & Skala Tampilan
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Pilih jenis font dan ukuran yang merepresentasikan identitas studio fotografi Anda.
            Perubahan berlaku instan (realtime) di seluruh Dashboard Studio dan Galeri Publik Pelanggan.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
            <span className="bg-white/15 px-3 py-1 rounded-xl font-mono text-blue-200">
              Font Aktif: <strong>{selectedFontFamily}</strong>
            </span>
            <span className="bg-white/15 px-3 py-1 rounded-xl font-mono text-indigo-200">
              Base Size: <strong>{currentPx}px</strong> ({selectedFontSize.toUpperCase()})
            </span>
          </div>
        </div>

        <div className="absolute -right-8 -bottom-10 opacity-10 pointer-events-none">
          <Type className="w-64 h-64 text-white" />
        </div>
      </div>

      {/* Control Bar: Auto-save, Save Button, Reset Button */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoSave}
              onChange={(e) => setAutoSave(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <span className="text-xs font-bold text-slate-700">Simpan Otomatis ke Database</span>
          </label>
          <span className="text-[11px] text-slate-400 hidden sm:inline">•</span>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Tersimpan per akun studio tanpa memengaruhi studio lain
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
            title="Kembalikan ke Inter 16px"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset ke Default</span>
          </button>

          <button
            type="button"
            onClick={handleManualSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
          >
            {saveSuccess ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>Tersimpan!</span>
              </>
            ) : isSaving ? (
              <span>Menyimpan...</span>
            ) : (
              <>
                <Check className="w-4 h-4 text-blue-200" />
                <span>Simpan Perubahan</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 1. Font Family Selection */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Type className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">1. Pilihan Font Family</h3>
              <p className="text-xs text-slate-500">Pilih satu jenis huruf untuk seluruh antarmuka aplikasi</p>
            </div>
          </div>
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            {selectedFontFamily}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
          {FONT_FAMILY_OPTIONS.map((f) => {
            const isSelected = selectedFontFamily === f.id;
            return (
              <div
                key={f.id}
                onClick={() => handleSelectFont(f.id)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-3 ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20 shadow-md'
                    : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900" style={{ fontFamily: f.fontStack }}>
                      {f.name}
                    </span>
                    {f.id === 'Inter' && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                        Default
                      </span>
                    )}
                    {isSelected && f.id !== 'Inter' && (
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-blue-100" />
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-slate-500">{f.category}</p>
                </div>

                <div
                  className="p-3 bg-slate-100/80 rounded-xl border border-slate-200/60 text-xs text-slate-800 font-semibold truncate"
                  style={{ fontFamily: f.fontStack }}
                >
                  {f.sampleText}
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">{f.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Font Size Scale Selection */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">2. Pilihan Font Size (Skala Teks)</h3>
              <p className="text-xs text-slate-500">
                Mengatur ukuran dasar (base scale) yang menyesuaikan seluruh hierarki teks secara proporsional
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200 font-mono">
            {currentPx}px
          </span>
        </div>

        {/* Segmented Scale Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-2">
          {FONT_SIZE_OPTIONS.map((s) => {
            const isSelected = selectedFontSize === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelectSize(s.id)}
                className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center space-y-1 ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-600/20 shadow-md text-indigo-950'
                    : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span className="text-xs font-bold uppercase tracking-wider">{s.id.toUpperCase()}</span>
                <span className="text-sm font-extrabold font-mono">{s.px}px</span>
                <span className="text-[10px] text-slate-500 truncate">{s.scale}</span>
              </button>
            );
          })}
        </div>

        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center gap-2 text-xs text-slate-600">
          <Info className="w-4 h-4 text-blue-500 shrink-0" />
          <span>
            Ukuran aktif: <strong>{FONT_SIZE_OPTIONS.find((s) => s.id === selectedFontSize)?.description}</strong>
          </span>
        </div>
      </div>

      {/* 3. Interactive Live Typography Preview Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">3. Preview Typography Realtime</h3>
              <p className="text-xs text-slate-500">
                Simulasi tampilan font <strong>{selectedFontFamily}</strong> pada ukuran <strong>{currentPx}px</strong>
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">
            Live Renderer
          </span>
        </div>

        {/* Mock Public Gallery Component */}
        <div
          className="border border-slate-200 rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-sky-50/50 via-white to-slate-50 shadow-inner space-y-6"
          style={{ fontFamily: currentStack }}
        >
          {/* Header Preview */}
          <div className="space-y-1.5 border-b border-slate-200 pb-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>GALERI FOTO DIGITAL RESMI</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              Wedding of Dimas & Sarah — Special Moments
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              Fotografi Profesional oleh {profile?.studioName || 'Seven Studio Photography'}
            </p>
          </div>

          {/* Paragraph Preview */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Contoh Deskripsi & Narasi Acara:
            </h4>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              Selamat datang di galeri foto eksklusif Anda. Setiap foto diambil dengan dedikasi tinggi untuk
              mengabadikan momen paling berharga dalam hidup Anda. Silakan pilih foto favorit Anda dengan menekan ikon
              hati (❤️) dan tambahkan catatan khusus untuk keperluan cetak atau album fisik.
            </p>
          </div>

          {/* Badges Preview */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Contoh Badge & Status:</h4>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold">
                ✓ Sisa 30 Hari Aktif
              </span>
              <span className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full font-bold">
                ❤️ 12 Foto Terpilih
              </span>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-bold">
                ⚡ Preview Ringan Aktif
              </span>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full font-bold">
                ✨ Preview HD Siap
              </span>
            </div>
          </div>

          {/* Buttons Preview */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Contoh Tombol Aksi:</h4>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                <span>Download Semua (ZIP)</span>
              </button>

              <button
                type="button"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Kirim Pilihan ke WhatsApp Studio</span>
              </button>

              <button
                type="button"
                className="px-4 py-2 bg-rose-500 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2"
              >
                <Heart className="w-3.5 h-3.5 fill-current" />
                <span>Pilih Foto Favorit</span>
              </button>
            </div>
          </div>

          {/* Sample Photo Card Cardlet */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Contoh Kartu Foto (Rasio Portrait 9:16):
            </h4>
            <div className="max-w-[180px] bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="w-full aspect-[9/16] bg-slate-900 flex items-center justify-center text-white relative">
                <span className="text-xs font-mono text-slate-400">9:16 Portrait</span>
                <span className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-full">
                  <Heart className="w-3 h-3 fill-current" />
                </span>
              </div>
              <div className="p-2.5 bg-white space-y-1">
                <p className="text-[11px] font-bold text-slate-800 truncate">DSC_0042_Ceremony.jpg</p>
                <p className="text-[10px] text-slate-400 font-mono">14.2 MB • 4000 × 6000 px</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
