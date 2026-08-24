import React, { useState, useRef } from 'react';
import { 
  Palette, 
  Save, 
  Camera, 
  Phone, 
  Instagram, 
  Globe, 
  MapPin, 
  Smartphone, 
  Check,
  Image as ImageIcon,
  Upload,
  Trash2,
  RefreshCw,
  Info,
  AlertCircle,
  Sparkles,
  FileCheck
} from 'lucide-react';
import { StudioProfile, UserAccount } from '../types';
import { uploadStudioLogo, deleteStudioLogo } from '../services/storageService';

interface BrandingSettingsProps {
  studioProfile: StudioProfile;
  currentUser?: UserAccount | null;
  onSaveProfile: (updated: StudioProfile) => Promise<void> | void;
}

const PRESET_COLORS = [
  { label: 'Navy & Teal', hex: '#0796a6' },
  { label: 'Royal Blue', hex: '#1473e6' },
  { label: 'Emerald Mint', hex: '#00a86b' },
  { label: 'Amber Gold', hex: '#d97706' },
  { label: 'Rose Luxury', hex: '#e11d48' },
  { label: 'Deep Violet', hex: '#7c3aed' },
  { label: 'Classic Slate', hex: '#334155' },
];

export const BrandingSettings: React.FC<BrandingSettingsProps> = ({
  studioProfile,
  currentUser,
  onSaveProfile,
}) => {
  const [form, setForm] = useState<StudioProfile>({ 
    ...studioProfile,
    studioLogoUrl: studioProfile.studioLogoUrl || studioProfile.logoUrl,
    logoUrl: studioProfile.logoUrl || studioProfile.studioLogoUrl,
  });

  const [logoPreview, setLogoPreview] = useState<string | null>(
    studioProfile.studioLogoUrl || studioProfile.logoUrl || null
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotification, setSuccessNotification] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate and handle selected file
  const handleProcessFile = (file: File) => {
    setErrorMessage(null);
    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];

    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setErrorMessage('Format file tidak didukung. Harap unggah logo dalam format PNG, JPG/JPEG, WebP, atau SVG.');
      return;
    }

    if (file.size > MAX_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      setErrorMessage(`Ukuran file terlalu besar (${sizeMB} MB). Maksimal ukuran file adalah 2 MB.`);
      return;
    }

    setSelectedFile(file);

    // Create local object URL for instant preview
    const objectUrl = URL.createObjectURL(file);
    setLogoPreview(objectUrl);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleProcessFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveLogo = async () => {
    setErrorMessage(null);
    setSelectedFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    const updated = {
      ...form,
      studioLogoUrl: undefined,
      logoUrl: undefined,
      studioLogoPath: undefined,
    };
    delete updated.studioLogoUrl;
    delete updated.logoUrl;
    delete updated.studioLogoPath;
    setForm(updated);

    if (currentUser?.id) {
      setIsUploadingLogo(true);
      await deleteStudioLogo(currentUser.id);
      setIsUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotification(null);
    setIsSaving(true);

    try {
      let finalLogoUrl = form.studioLogoUrl || form.logoUrl;

      // If user selected a new file, upload it first
      if (selectedFile && currentUser?.id) {
        setIsUploadingLogo(true);
        const uploadResult = await uploadStudioLogo(currentUser.id, selectedFile);
        setIsUploadingLogo(false);

        if (!uploadResult.success) {
          setErrorMessage(uploadResult.error || 'Gagal mengunggah logo studio ke server.');
          setIsSaving(false);
          return;
        }

        finalLogoUrl = uploadResult.logoUrl;
        setLogoPreview(uploadResult.logoUrl || null);
        setSelectedFile(null);
      }

      const updatedProfile: StudioProfile = {
        ...form,
        studioLogoUrl: finalLogoUrl,
        logoUrl: finalLogoUrl,
        updatedAt: new Date().toISOString(),
      };

      setForm(updatedProfile);
      await onSaveProfile(updatedProfile);

      setSuccessNotification('Logo studio & profil branding berhasil diperbarui.');
      setTimeout(() => setSuccessNotification(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat menyimpan pengaturan.');
    } finally {
      setIsSaving(false);
      setIsUploadingLogo(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Profil & Branding Studio</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
              Multi-Tenant
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Kustomisasi logo resmi, nama studio, kontak WhatsApp, domain publik, dan tema visual galeri pelanggan.
          </p>
        </div>

        <button
          id="btn-save-branding-header"
          type="button"
          onClick={handleSubmit}
          disabled={isSaving || isUploadingLogo}
          className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-slate-900 hover:bg-slate-800 active:scale-98 shadow-sm transition cursor-pointer disabled:opacity-50"
        >
          {isSaving ? (
            <RefreshCw className="w-4 h-4 animate-spin text-teal-400" />
          ) : successNotification ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>
            {isSaving ? 'Menyimpan...' : successNotification ? 'Tersimpan!' : 'Simpan Perubahan'}
          </span>
        </button>
      </div>

      {/* Alert / Notification Feedback */}
      {successNotification && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-medium flex items-center gap-2.5 animate-in fade-in">
          <FileCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successNotification}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-medium flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form (7 cols) */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-6">
          
          {/* 1. STUDIO LOGO CARD (REQUIREMENT #1, #2, #3, #4) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Camera className="w-4 h-4 text-teal-600" />
                  Logo Studio
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Logo akan digunakan sebagai identitas studio pada galeri pelanggan dan elemen branding aplikasi.
                </p>
              </div>
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {/* Logo Preview & Upload Area */}
            {logoPreview ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Visual Box with checkered pattern for transparency check */}
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-white border border-slate-200 shadow-inner flex items-center justify-center p-2 relative overflow-hidden shrink-0">
                    <img
                      src={logoPreview}
                      alt="Preview Logo Studio"
                      className="max-h-full max-w-full object-contain"
                      referrerPolicy="no-referrer"
                      onError={() => {
                        setErrorMessage('Gagal memuat preview logo.');
                      }}
                    />
                  </div>

                  <div className="flex-1 space-y-1.5 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {selectedFile ? selectedFile.name : 'Logo Studio Aktif'}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {selectedFile ? 'Siap Disimpan' : 'Terpasang'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      {selectedFile
                        ? `Ukuran: ${(selectedFile.size / 1024).toFixed(1)} KB — Klik "Simpan Perubahan" untuk menerapkan ke seluruh galeri.`
                        : 'Logo ini akan tampil otomatis di header galeri pelanggan dan kartu QR Code.'}
                    </p>

                    <div className="flex items-center justify-center sm:justify-start gap-2 pt-2">
                      <button
                        id="btn-change-logo"
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-teal-500 hover:text-teal-700 text-xs font-semibold text-slate-700 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Ganti Logo</span>
                      </button>

                      <button
                        id="btn-remove-logo"
                        type="button"
                        onClick={handleRemoveLogo}
                        className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 hover:bg-rose-50 text-xs font-semibold text-rose-600 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus Logo</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Drag and Drop Zone */
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? 'border-teal-500 bg-teal-50/50 scale-[0.99]'
                    : 'border-slate-300 hover:border-teal-400 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto text-teal-600 shadow-2xs mb-3">
                  <Upload className="w-5 h-5" />
                </div>

                <p className="text-xs sm:text-sm font-bold text-slate-800">
                  Klik untuk memilih file atau seret logo ke sini
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Format didukung: <span className="font-semibold text-slate-700">PNG, JPG/JPEG, WebP, SVG</span>
                </p>
                <p className="text-[10px] text-teal-700 font-medium mt-1">
                  Prioritaskan PNG transparan • Maksimal 2 MB • Rekomendasi 512 × 512 px
                </p>
              </div>
            )}

            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
              <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <span>
                Jika logo belum diunggah, aplikasi akan menggunakan lencana monogram inisial atau ikon kamera modern secara otomatis.
              </span>
            </div>
          </div>

          {/* 2. STUDIO PROFILE INFORMATION CARD */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
              <Sparkles className="w-4 h-4 text-teal-600" />
              Informasi Studio
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Studio Foto <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.studioName}
                  onChange={(e) => setForm({ ...form, studioName: e.target.value })}
                  placeholder="Contoh: Kencana Art & Wedding Photography"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-teal-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Slogan / Tagline Studio
                </label>
                <input
                  type="text"
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                  placeholder="Contoh: Capturing Timeless Moments & Cinematic Stories"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-teal-500 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Contact Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  Nomor WhatsApp Studio
                </label>
                <input
                  type="text"
                  value={form.whatsappNumber}
                  onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
                  placeholder="6281234567890"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-teal-500 focus:bg-white transition"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Format internasional dengan 62 (contoh: 6281234567890)
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Instagram className="w-3.5 h-3.5 text-pink-600" />
                  Username Instagram
                </label>
                <input
                  type="text"
                  value={form.instagram}
                  onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                  placeholder="@kencanaphoto"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-teal-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-blue-600" />
                  Website / Portofolio
                </label>
                <input
                  type="text"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="https://kencanastudio.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-teal-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-600" />
                  Kota / Alamat Singkat
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Surabaya, Jawa Timur"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-teal-500 focus:bg-white transition"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-teal-600" />
                  Domain Kustom Galeri Pelanggan (Opsional)
                </label>
                <input
                  type="text"
                  value={form.customGalleryDomain || ''}
                  onChange={(e) => setForm({ ...form, customGalleryDomain: e.target.value })}
                  placeholder="Contoh: https://galeri.kencanastudio.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-mono focus:outline-none focus:border-teal-500 focus:bg-white transition"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Jika Anda menggunakan domain sendiri, QR Code dan link yang digenerate akan menggunakan domain ini. Biarkan kosong untuk menggunakan domain aplikasi otomatis.
                </p>
              </div>
            </div>
          </div>

          {/* 3. GALLERY THEME & MESSAGES CARD */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
              <Palette className="w-4 h-4 text-teal-600" />
              Warna & Pesan Galeri
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Warna Aksen Galeri
              </label>
              <div className="flex flex-wrap items-center gap-2.5">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => setForm({ ...form, accentColor: preset.hex })}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
                      form.accentColor === preset.hex
                        ? 'border-teal-600 bg-teal-50 text-teal-900 font-bold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shadow-xs border border-slate-300"
                      style={{ backgroundColor: preset.hex }}
                    />
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Pesan Pembuka Galeri (Greetings Klien)
              </label>
              <textarea
                rows={2}
                value={form.welcomeMessage}
                onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
                placeholder="Selamat menikmati galeri foto kenangan terbaik Anda."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-teal-500 focus:bg-white transition resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Teks Footer Galeri Pelanggan
              </label>
              <input
                type="text"
                value={form.galleryFooterText}
                onChange={(e) => setForm({ ...form, galleryFooterText: e.target.value })}
                placeholder="Terima kasih telah mempercayakan momen terbaik Anda bersama kami."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-teal-500 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Bottom Save Button */}
          <div className="pt-2">
            <button
              id="btn-save-branding-bottom"
              type="submit"
              disabled={isSaving || isUploadingLogo}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white bg-teal-600 hover:bg-teal-700 active:scale-[0.99] shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : successNotification ? (
                <Check className="w-4 h-4 text-emerald-200" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>
                {isSaving ? 'Menyimpan Perubahan...' : successNotification ? 'Branding Berhasil Disimpan!' : 'Simpan Semua Perubahan'}
              </span>
            </button>
          </div>
        </form>

        {/* Right Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 sticky top-20">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-teal-600" />
                Live Preview Galeri Pelanggan
              </span>
              <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                Modern Navy & Teal
              </span>
            </div>

            {/* Simulated Phone Mockup */}
            <div className="border-4 border-slate-900 rounded-3xl p-3 bg-slate-900 text-white shadow-xl overflow-hidden">
              <div className="w-20 h-3.5 bg-slate-800 rounded-full mx-auto mb-3" />

              {/* Simulated Customer Gallery Header */}
              <div className="bg-white text-slate-900 rounded-2xl p-4 text-center space-y-3 border border-slate-100 shadow-sm">
                
                {/* Logo Header Display */}
                <div className="flex flex-col items-center justify-center gap-1.5 pb-2 border-b border-slate-100">
                  {logoPreview ? (
                    <div className="h-10 max-w-[140px] flex items-center justify-center">
                      <img
                        src={logoPreview}
                        alt="Logo Preview"
                        className="max-h-full max-w-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div 
                      className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center font-bold text-white shadow-xs text-sm"
                      style={{ backgroundColor: form.accentColor || '#0796a6' }}
                    >
                      {form.studioName ? form.studioName.charAt(0).toUpperCase() : <Camera className="w-5 h-5" />}
                    </div>
                  )}

                  <div>
                    <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-tight">
                      {form.studioName || 'Nama Studio Foto'}
                    </h4>
                    <p className="text-[10px] text-slate-500 line-clamp-1">
                      {form.tagline || 'Professional Photography'}
                    </p>
                  </div>
                </div>

                {/* Simulated Album Cover */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-700 text-left">
                  <div className="flex items-center justify-between text-[10px] font-bold text-teal-700 mb-1">
                    <span>ALBUM KENANGAN</span>
                    <span>24 FOTO</span>
                  </div>
                  <p className="font-bold text-slate-900 text-xs">Wedding of Sarah & Kevin</p>
                  <p className="text-[10px] text-slate-500 italic mt-0.5">"{form.welcomeMessage || 'Selamat menikmati galeri foto Anda.'}"</p>
                </div>

                {/* Sample thumbnails */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <div className="aspect-square bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div className="aspect-square bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div className="aspect-square bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                </div>

                {/* Simulated Footer */}
                <div className="pt-3 border-t border-slate-100 text-[9px] text-slate-400">
                  {form.galleryFooterText || 'Terima kasih telah mempercayakan momen terbaik Anda bersama kami.'}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 text-center">
              Perubahan logo & branding otomatis langsung diterapkan ke semua tautan galeri publik milik Anda.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
