import React, { useState, useEffect } from 'react';
import { Copy, Check, Download, ExternalLink, Share2, Printer, Shield, AlertTriangle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Album, StudioProfile } from '../../types';
import { getPublicGalleryUrl, isProductionUrlConfigured, isAiStudioHost, getFrontendPublicUrl } from '../../config/appConfig';
import { generateGalleryQRDataUrl, generateBrandedQRCard } from '../../services/qrService';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  album: Album | null;
  studioProfile?: StudioProfile | null;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  album,
  studioProfile,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isGeneratingCard, setIsGeneratingCard] = useState<boolean>(false);

  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    if (album && isOpen) {
      setQrError(null);
      generateGalleryQRDataUrl(album.galleryId)
        .then((url) => {
          setQrDataUrl(url);
        })
        .catch((err) => {
          console.error('[QR] Modal generation error:', err);
          setQrError(err.message || 'Gagal membuat QR Code.');
        });
    }
  }, [album, isOpen]);

  if (!album) return null;

  const publicUrl = getPublicGalleryUrl(album.galleryId);
  const isProdConfigured = isProductionUrlConfigured();
  const currentBase = getFrontendPublicUrl();
  const hasAiStudioDomain = isAiStudioHost(currentBase);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn('Clipboard copy error:', err);
    }
  };

  const handleDownloadQRPng = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR_${album.galleryId}_${album.albumName.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadBrandedCard = async () => {
    setIsGeneratingCard(true);
    try {
      const cardDataUrl = await generateBrandedQRCard({
        galleryId: album.galleryId,
        albumName: album.albumName,
        clientName: album.clientName,
        pin: album.isPinEnabled ? album.pin : undefined,
        studioName: studioProfile?.studioName || 'Studio Foto Kami',
        brandColor: studioProfile?.brandColor || '#2563eb',
        logoUrl: studioProfile?.logoUrl,
      });

      const a = document.createElement('a');
      a.href = cardDataUrl;
      a.download = `Kartu_Galeri_${album.galleryId}_${album.albumName.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('[QR] Error generating printable card:', err);
    } finally {
      setIsGeneratingCard(false);
    }
  };

  const handleShareWhatsApp = () => {
    const text = `Halo Kak ${album.clientName}! ✨\n\nFoto-foto dokumentasi "${album.albumName}" sudah siap diakses melalui Galeri Foto Digital resmi kami.\n\n🔗 *Tautan Galeri:* ${publicUrl}\n🔑 *Gallery ID:* ${album.galleryId}${album.isPinEnabled && album.pin ? `\n🔒 *PIN Galeri:* ${album.pin}` : ''}\n\nSilakan buka tautan di atas untuk melihat foto, memilih foto favorit ❤️, dan mengunduh foto asli beresolusi tinggi. Terima kasih! 🙏`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tautan & QR Code Galeri"
      subtitle={`Gallery ID: ${album.galleryId} • ${album.clientName}`}
      maxWidth="lg"
    >
      <div className="space-y-6">
        {/* QR Code Preview Box */}
        <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200/80 rounded-2xl">
          <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200">
            {qrError ? (
              <div className="w-56 h-56 flex flex-col items-center justify-center p-4 text-center text-red-600 bg-red-50 rounded-lg">
                <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
                <p className="text-xs font-bold">Gagal Membuat QR Code</p>
                <p className="text-[11px] text-red-700 mt-1">{qrError}</p>
              </div>
            ) : qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR Code ${album.galleryId}`}
                className="w-56 h-56 object-contain rounded-lg"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-slate-400">
                Membuat QR Code...
              </div>
            )}
          </div>

          <div className="mt-4 text-center">
            <span className="inline-flex items-center px-3 py-1 bg-slate-900 text-white font-mono font-bold text-sm rounded-full tracking-wider shadow-sm">
              ID: {album.galleryId}
            </span>
            {album.isPinEnabled && album.pin && (
              <div className="mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
                <Shield className="w-3.5 h-3.5" />
                PIN Galeri: <span className="font-mono tracking-widest text-sm">{album.pin}</span>
              </div>
            )}
          </div>
        </div>

        {/* Warning if running on development or AI Studio environment without production URL */}
        {(!isProdConfigured || hasAiStudioDomain) && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Perhatian: URL Publik Production Belum Dikonfigurasi</p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Tautan pelanggan saat ini menggunakan origin development. Untuk production, atur <strong>FRONTEND_PUBLIC_URL</strong> (domain GitHub Pages studio Anda) di menu <strong>Pengaturan</strong> agar QR Code dicetak dengan domain resmi.
              </p>
            </div>
          </div>
        )}

        {/* Public Gallery Link Box */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Tautan Publik Galeri (Tanpa Perlu Login)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={publicUrl}
              className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 select-all focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleCopyLink}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-medium text-xs transition-all shadow-sm ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Tersalin!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Salin Tautan
                </>
              )}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            💡 QR Code dan Salin Tautan menghasilkan URL yang identik 100% dan dapat dibuka pelanggan secara langsung.
          </p>
        </div>

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            onClick={handleDownloadBrandedCard}
            disabled={isGeneratingCard}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Printer className="w-4 h-4 text-blue-400" />
            {isGeneratingCard ? 'Membuat Kartu...' : 'Download Kartu Cetak'}
          </button>

          <button
            onClick={handleShareWhatsApp}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Share2 className="w-4 h-4" />
            Kirim ke WhatsApp Pelanggan
          </button>

          <button
            onClick={handleDownloadQRPng}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-all"
          >
            <Download className="w-4 h-4" />
            Download QR Saja (.PNG)
          </button>

          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            Buka Halaman Galeri
          </a>
        </div>
      </div>
    </Modal>
  );
};
