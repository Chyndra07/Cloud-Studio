import React, { useState, useRef, useEffect } from 'react';
import {
  Palette,
  Check,
  Camera,
  Phone,
  Mail,
  MapPin,
  Globe,
  Sparkles,
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  AlertCircle,
  Layout,
  RotateCcw,
} from 'lucide-react';
import { StudioProfile } from '../types';
import {
  validateLogoFile,
  processStudioLogo,
  validateBannerFile,
  processStudioBanner,
} from '../services/logoStorageService';
import { ModernStudioBanner } from '../components/banner/ModernStudioBanner';

interface BrandingPageProps {
  profile: StudioProfile | null;
  onSaveProfile: (updates: Partial<StudioProfile>) => Promise<void>;
  isProcessing?: boolean;
}

const PRESET_COLORS = [
  { name: 'Royal Blue', hex: '#2563eb' },
  { name: 'Emerald Green', hex: '#059669' },
  { name: 'Deep Indigo', hex: '#4f46e5' },
  { name: 'Rose Luxury', hex: '#e11d48' },
  { name: 'Amber Gold', hex: '#d97706' },
  { name: 'Violet Purple', hex: '#7c3aed' },
  { name: 'Slate Dark', hex: '#0f172a' },
  { name: 'Teal Modern', hex: '#0d9488' },
];

export const BrandingPage: React.FC<BrandingPageProps> = ({
  profile,
  onSaveProfile,
  isProcessing,
}) => {
  const [studioName, setStudioName] = useState(profile?.studioName || '');
  const [whatsappNumber, setWhatsappNumber] = useState(profile?.whatsappNumber || '');
  const [emailContact, setEmailContact] = useState(profile?.emailContact || profile?.ownerEmail || '');
  const [address, setAddress] = useState(profile?.address || '');
  const [website, setWebsite] = useState(profile?.website || '');
  const [brandColor, setBrandColor] = useState(profile?.brandColor || '#2563eb');

  // Logo management states
  const [logoUrl, setLogoUrl] = useState(profile?.logoUrl || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(profile?.logoUrl || null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Banner management states
  const [bannerUrl, setBannerUrl] = useState(profile?.bannerUrl || '');
  const [selectedBannerFile, setSelectedBannerFile] = useState<File | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(profile?.bannerUrl || null);
  const [isDraggingBanner, setIsDraggingBanner] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [showResetBannerConfirm, setShowResetBannerConfirm] = useState(false);

  const [isSavingAll, setIsSavingAll] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if profile prop changes from server
  useEffect(() => {
    if (profile) {
      setStudioName(profile.studioName || '');
      setWhatsappNumber(profile.whatsappNumber || '');
      setEmailContact(profile.emailContact || profile.ownerEmail || '');
      setAddress(profile.address || '');
      setWebsite(profile.website || '');
      setBrandColor(profile.brandColor || '#2563eb');

      if (!selectedFile) {
        setLogoUrl(profile.logoUrl || '');
        setPreviewUrl(profile.logoUrl || null);
      }
      if (!selectedBannerFile) {
        setBannerUrl(profile.bannerUrl || '');
        setBannerPreviewUrl(profile.bannerUrl || null);
      }
    }
  }, [profile]);

  // Handle Logo Selection
  const handleFileSelect = (file: File) => {
    setUploadError(null);
    const validation = validateLogoFile(file);
    if (!validation.valid) {
      setUploadError(validation.error || 'File logo tidak valid.');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveLogo = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setLogoUrl('');
    setShowDeleteConfirm(false);
    setUploadError(null);
  };

  // Handle Banner Selection
  const handleBannerSelect = (file: File) => {
    setBannerError(null);
    const validation = validateBannerFile(file);
    if (!validation.valid) {
      setBannerError(validation.error || 'File banner tidak valid.');
      return;
    }

    setSelectedBannerFile(file);
    const objectUrl = URL.createObjectURL(file);
    setBannerPreviewUrl(objectUrl);
  };

  const handleBannerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingBanner(true);
  };

  const handleBannerDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingBanner(false);
  };

  const handleBannerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingBanner(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleBannerSelect(e.dataTransfer.files[0]);
    }
  };

  const handleResetBannerToDefault = () => {
    setSelectedBannerFile(null);
    setBannerPreviewUrl(null);
    setBannerUrl('');
    setShowResetBannerConfirm(false);
    setBannerError(null);
  };

  // Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAll(true);
    setUploadError(null);
    setBannerError(null);

    try {
      let finalLogoUrl = logoUrl;
      let finalBannerUrl = bannerUrl;

      // 1. Process Logo if newly selected
      if (selectedFile && profile?.uid) {
        finalLogoUrl = await processStudioLogo(profile.uid, selectedFile);
        setLogoUrl(finalLogoUrl);
        setPreviewUrl(finalLogoUrl);
        setSelectedFile(null);
      }

      // 2. Process Banner if newly selected
      if (selectedBannerFile && profile?.uid) {
        finalBannerUrl = await processStudioBanner(profile.uid, selectedBannerFile);
        setBannerUrl(finalBannerUrl);
        setBannerPreviewUrl(finalBannerUrl);
        setSelectedBannerFile(null);
      }

      await onSaveProfile({
        studioName: studioName.trim(),
        logoUrl: finalLogoUrl.trim(),
        bannerUrl: finalBannerUrl.trim(),
        whatsappNumber: whatsappNumber.trim(),
        emailContact: emailContact.trim(),
        address: address.trim(),
        website: website.trim(),
        brandColor,
      });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      console.error('[BRANDING] Save profile error:', err);
      setUploadError(err?.message || 'Gagal menyimpan profil & branding studio.');
    } finally {
      setIsSavingAll(false);
    }
  };

  const isBusy = isProcessing || isSavingAll;

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Profil & Branding Studio</h2>
        <p className="text-xs text-slate-500">
          Kustomisasi identitas studio foto, logo, banner galeri, dan tema portal pelanggan Anda.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Settings */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nama Studio */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nama Studio Foto <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={studioName}
                onChange={(e) => setStudioName(e.target.value)}
                placeholder="Contoh: Lumina Visual Studio, Artisan Moments"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
              />
            </div>

            {/* ========================================================= */}
            {/* 1. LOGO STUDIO COMPONENT                                  */}
            {/* ========================================================= */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-blue-600" /> Logo Studio
                </label>
                <span className="text-[11px] text-slate-400 font-medium">
                  PNG (Transparan), JPG, atau WEBP • Maks. 5 MB
                </span>
              </div>

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                  e.target.value = '';
                }}
              />

              {/* Error Notice */}
              {uploadError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Logo Preview & Actions */}
              {previewUrl ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    {/* Checkerboard container to verify transparency */}
                    <div className="w-20 h-20 rounded-xl border border-slate-200 bg-white relative overflow-hidden flex items-center justify-center shrink-0 shadow-inner [background-image:linear-gradient(45deg,#f1f5f9_25%,transparent_25%),linear-gradient(-45deg,#f1f5f9_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f1f5f9_75%),linear-gradient(-45deg,transparent_75%,#f1f5f9_75%)] [background-size:12px_12px] [background-position:0_0,0_6px,6px_-6px,-6px_0]">
                      <img
                        src={previewUrl}
                        alt="Pratinjau Logo"
                        className="w-full h-full object-contain p-1.5 transition-transform hover:scale-105"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {selectedFile ? selectedFile.name : 'Logo Studio Aktif'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {selectedFile
                          ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Siap disimpan`
                          : 'Tersimpan & Aktif pada Galeri Pelanggan'}
                      </p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-semibold rounded-md border border-emerald-200">
                        {selectedFile ? 'Perubahan Belum Disimpan' : 'Logo Terpasang'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Ganti Logo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Drag & Drop Upload Area (Empty State) */
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-2 ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50/60 scale-[1.01]'
                      : 'border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/20'
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shadow-xs mb-1">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">
                    Klik untuk memilih logo atau seret file ke sini
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm">
                    Gunakan file gambar berlatar transparan (PNG direkomendasikan) agar logo tampil elegan pada QR Card dan portal pelanggan.
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
                  >
                    Pilih File Logo
                  </button>
                </div>
              )}

              {/* Delete Confirmation Dialog */}
              {showDeleteConfirm && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-3 animate-fade-in">
                  <div className="flex items-center gap-2 text-rose-800 text-xs">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Hapus logo studio ini? Klik "Simpan" setelahnya untuk memperbarui profil.</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                    >
                      Ya, Hapus
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ========================================================= */}
            {/* 2. BANNER GALERI STUDIO COMPONENT                         */}
            {/* ========================================================= */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Layout className="w-3.5 h-3.5 text-blue-600" /> Banner Galeri Studio
                  </label>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Banner landscape resmi untuk seluruh portal album foto pelanggan Anda.
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  Rasio 16:5 / 3:1 • Maks. 10 MB
                </span>
              </div>

              {/* Hidden Banner File Input */}
              <input
                ref={bannerFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleBannerSelect(e.target.files[0]);
                  }
                  e.target.value = '';
                }}
              />

              {/* Banner Error Notice */}
              {bannerError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{bannerError}</span>
                </div>
              )}

              {/* Interactive Banner Status & Actions Card */}
              <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        bannerPreviewUrl
                          ? 'bg-blue-600 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {bannerPreviewUrl ? 'Banner Custom Aktif' : 'Banner Default Resmi'}
                    </span>
                    <span className="text-xs font-semibold text-slate-700">
                      {bannerPreviewUrl
                        ? selectedBannerFile
                          ? `File baru: ${selectedBannerFile.name}`
                          : 'Kustom studio foto Anda'
                        : 'Modern Premium Photography Studio'}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => bannerFileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{bannerPreviewUrl ? 'Ganti Banner' : 'Upload Banner'}</span>
                    </button>

                    {bannerPreviewUrl && (
                      <button
                        type="button"
                        onClick={() => setShowResetBannerConfirm(true)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Kembalikan ke Banner Default"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset ke Default</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Banner Live Visual Preview */}
                <div className="rounded-xl overflow-hidden shadow-xs">
                  <ModernStudioBanner
                    albumName="Dimas & Anisa Wedding"
                    clientName="Dimas"
                    eventDate="30 Oktober 2026"
                    photoCount={85}
                    daysRemaining={30}
                    customBannerUrl={bannerPreviewUrl}
                    studioName={studioName}
                    brandColor={brandColor}
                    compact={true}
                  />
                </div>

                {/* Drag-Drop Target Area if user wants to drop a new banner */}
                <div
                  onDragOver={handleBannerDragOver}
                  onDragLeave={handleBannerDragLeave}
                  onDrop={handleBannerDrop}
                  onClick={() => bannerFileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all ${
                    isDraggingBanner
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-blue-400 bg-white hover:bg-blue-50/20'
                  }`}
                >
                  <p className="text-[11px] text-slate-600 font-medium">
                    Seret berkas gambar ke sini untuk mengganti banner secara instan, atau klik untuk memilih berkas.
                  </p>
                </div>
              </div>

              {/* Reset Banner Confirmation Dialog */}
              {showResetBannerConfirm && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-3 animate-fade-in">
                  <div className="flex items-center gap-2 text-rose-800 text-xs">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Kembalikan seluruh album ke Banner Default resmi? Klik "Simpan" setelahnya.</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleResetBannerToDefault}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                    >
                      Ya, Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowResetBannerConfirm(false)}
                      className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Nomor WhatsApp & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp Studio
                </label>
                <input
                  type="text"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value.replace(/[^0-9+]/g, ''))}
                  placeholder="Contoh: 6281234567890"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600" /> Email Kontak
                </label>
                <input
                  type="email"
                  value={emailContact}
                  onChange={(e) => setEmailContact(e.target.value)}
                  placeholder="studio@gmail.com"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Alamat & Website */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" /> Alamat / Kota
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Jakarta Selatan, Indonesia"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-indigo-600" /> Website / Instagram
                </label>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://instagram.com/studioanda"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Warna Brand Utama */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-purple-600" /> Warna Identitas Brand
              </label>

              <div className="flex items-center gap-2 flex-wrap mb-3">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setBrandColor(c.hex)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center transition-transform hover:scale-110 shadow-sm border border-black/10"
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {brandColor === c.hex && <Check className="w-4 h-4 text-white" />}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="w-10 h-10 rounded-xl cursor-pointer border-0 bg-transparent"
                />
                <input
                  type="text"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="w-32 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
              <button
                type="submit"
                disabled={isBusy}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
              >
                {isBusy ? 'Menyimpan Perubahan...' : 'Simpan Profil & Branding'}
              </button>

              {savedSuccess && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 animate-fade-in">
                  <Check className="w-4 h-4" /> Profil, Logo & Banner berhasil disimpan!
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Live Preview Card */}
        <div className="lg:col-span-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Pratinjau Tampilan Pelanggan
          </h3>

          {/* Client Header Mock */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
            {/* Studio Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shadow-xs shrink-0 overflow-hidden border border-slate-200/80 bg-white"
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Logo Studio"
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: brandColor }}
                    >
                      <Camera className="w-5 h-5" />
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{studioName || 'Nama Studio Foto'}</h4>
                  <p className="text-[10px] text-slate-400 font-medium">Galeri Foto Digital Resmi</p>
                </div>
              </div>

              {whatsappNumber && (
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-lg border border-emerald-200">
                  WA Ready
                </span>
              )}
            </div>

            {/* REALISTIC BANNER PREVIEW MOCK */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold px-1">
                <span>Pratinjau Banner Galeri Pelanggan:</span>
                <span className="text-[10px] font-mono text-blue-600">Rasio 16:5</span>
              </div>
              <ModernStudioBanner
                albumName="Dimas & Anisa Wedding"
                clientName="Dimas"
                eventDate="30 Oktober 2026"
                photoCount={85}
                daysRemaining={30}
                customBannerUrl={bannerPreviewUrl}
                studioName={studioName}
                brandColor={brandColor}
                compact={true}
              />
            </div>

            <p className="text-[11px] text-slate-500 text-center leading-relaxed">
              Banner dan logo ini akan diterapkan secara global pada seluruh album foto pelanggan, QR Code Cetak, dan Portal Galeri Pelanggan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
