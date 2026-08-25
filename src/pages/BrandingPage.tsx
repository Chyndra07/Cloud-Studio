import React, { useState } from 'react';
import { Palette, Check, Camera, Phone, Mail, MapPin, Globe, Shield, Sparkles } from 'lucide-react';
import { StudioProfile } from '../types';

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
  const [logoUrl, setLogoUrl] = useState(profile?.logoUrl || '');
  const [whatsappNumber, setWhatsappNumber] = useState(profile?.whatsappNumber || '');
  const [emailContact, setEmailContact] = useState(profile?.emailContact || profile?.ownerEmail || '');
  const [address, setAddress] = useState(profile?.address || '');
  const [website, setWebsite] = useState(profile?.website || '');
  const [brandColor, setBrandColor] = useState(profile?.brandColor || '#2563eb');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveProfile({
      studioName: studioName.trim(),
      logoUrl: logoUrl.trim(),
      whatsappNumber: whatsappNumber.trim(),
      emailContact: emailContact.trim(),
      address: address.trim(),
      website: website.trim(),
      brandColor,
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Profil & Branding Studio</h2>
        <p className="text-xs text-slate-500">
          Kustomisasi identitas studio foto Anda untuk QR Code dan portal galeri pelanggan.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Settings */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
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

            {/* Logo URL */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                URL Logo Studio (PNG / JPG / WEBP)
              </label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://domain.com/logo.png"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Gunakan tautan gambar berlatar transparan untuk hasil terbaik pada QR card.
              </p>
            </div>

            {/* Nomor WhatsApp & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                disabled={isProcessing}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all"
              >
                {isProcessing ? 'Menyimpan...' : 'Simpan Profil & Branding'}
              </button>

              {savedSuccess && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 animate-fade-in">
                  <Check className="w-4 h-4" /> Branding berhasil disimpan!
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
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-md shrink-0 overflow-hidden"
                  style={{ backgroundColor: brandColor }}
                >
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-5 h-5" />
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

            {/* Sample Album Mock Banner */}
            <div
              className="p-5 rounded-2xl text-white space-y-2 relative overflow-hidden"
              style={{ backgroundColor: brandColor }}
            >
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                Wedding Dokumentasi
              </span>
              <h5 className="text-base font-black">Dimas & Anisa Wedding</h5>
              <div className="flex items-center gap-3 text-[11px] opacity-90">
                <span>📍 Pelanggan: Dimas</span>
                <span>📸 85 Foto Asli</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 text-center">
              Warna brand dan logo ini akan diterapkan otomatis pada QR Code Cetak dan Portal Galeri Pelanggan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
