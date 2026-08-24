import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  ExternalLink, 
  Printer, 
  QrCode as QrIcon, 
  Lock, 
  Settings, 
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Database
} from 'lucide-react';
import { Album, StudioProfile } from '../types';
import { getPublicGalleryUrl, logQRDebug } from '../services/urlHelper';
import { verifyQRCodePayload, QRVerificationResult } from '../services/qrVerifier';
import { 
  republishAlbum, 
  verifyServerRecord,
} from '../services/storageService';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  album: Album | null;
  studioProfile: StudioProfile;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  album,
  studioProfile,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'qr' | 'print_card'>('qr');
  const [customDomainInput, setCustomDomainInput] = useState<string>(studioProfile.customGalleryDomain || '');
  const [showDomainEditor, setShowDomainEditor] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [serverRecord, setServerRecord] = useState<any>(null);

  // Real-time QR verification state
  const [qrVerification, setQrVerification] = useState<QRVerificationResult | null>(null);
  const [isTestingQr, setIsTestingQr] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const cleanGalleryId = album?.galleryId?.trim()?.toUpperCase() || '';
  
  // Single Source of Truth Final Absolute URL
  const finalCustomerUrl = cleanGalleryId
    ? (getPublicGalleryUrl(cleanGalleryId, customDomainInput || studioProfile.customGalleryDomain) || '').trim()
    : '';

  // Live Server Verification and Auto-Publish Flow
  useEffect(() => {
    if (!isOpen || !album || !cleanGalleryId) {
      setQrDataUrl('');
      setIsVerified(false);
      setIsVerifying(false);
      setVerifyError(null);
      setServerRecord(null);
      setQrVerification(null);
      return;
    }

    let isMounted = true;

    async function verifyAndPublish() {
      setIsVerifying(true);
      setVerifyError(null);

      try {
        // Direct server query
        const serverCheck = await verifyServerRecord(cleanGalleryId);
        if (serverCheck.exists && serverCheck.isPublished) {
          if (isMounted) {
            setIsVerified(true);
            setServerRecord(serverCheck.record);
            setIsVerifying(false);
          }
          return;
        }

        console.log(`[QRCodeModal] Auto-republishing gallery ${cleanGalleryId} to ensure server persistence...`);
        const result = await republishAlbum(album, album.ownerId);
        if (result.success && result.verified) {
          const verifiedCheck = await verifyServerRecord(cleanGalleryId);
          if (isMounted) {
            setIsVerified(true);
            setServerRecord(verifiedCheck.record);
            setIsVerifying(false);
          }
        } else {
          if (isMounted) {
            setVerifyError(result.error || 'Gagal memverifikasi galeri di server database.');
            setIsVerifying(false);
          }
        }
      } catch (err: any) {
        console.warn('[QRCodeModal] Verification warning:', err);
        if (isMounted) {
          setVerifyError(err.message || 'Koneksi ke backend server gagal.');
          setIsVerifying(false);
        }
      }
    }

    verifyAndPublish();

    return () => {
      isMounted = false;
    };
  }, [isOpen, album, cleanGalleryId]);

  // Generate QR Code deterministically from finalCustomerUrl and immediately verify by decoding
  useEffect(() => {
    if (!isOpen || !album || !finalCustomerUrl) {
      setQrDataUrl('');
      setQrVerification(null);
      return;
    }

    let isMounted = true;

    // Strict validation of raw URL payload
    const qrPayload = finalCustomerUrl;

    try {
      const parsedUrl = new URL(finalCustomerUrl);
      if (parsedUrl.hostname.includes('aistudio.google.com')) {
        console.error('[CRITICAL] Forbidden destination detected in QR Payload:', finalCustomerUrl);
        setVerifyError('QR tidak dapat dibuat karena mengarah ke editor AI Studio.');
        return;
      }
    } catch (e) {
      console.warn('URL parsing error:', e);
    }

    logQRDebug(cleanGalleryId, customDomainInput || studioProfile.customGalleryDomain);

    QRCode.toDataURL(qrPayload, {
      width: 600,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then(async (url) => {
        if (!isMounted) return;
        setQrDataUrl(url);

        // Immediate decode verification to guarantee 100% match
        const check = await verifyQRCodePayload(url, finalCustomerUrl);
        if (isMounted) {
          setQrVerification(check);
        }
      })
      .catch((err) => {
        console.error('Error generating QR:', err);
        if (isMounted) {
          setVerifyError('Gagal membuat gambar QR Code');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, album, finalCustomerUrl, cleanGalleryId, customDomainInput, studioProfile.customGalleryDomain]);

  if (!isOpen || !album) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(finalCustomerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPNG = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR_${album.eventName.replace(/\s+/g, '_')}_${album.galleryId}.png`;
    link.click();
  };

  const handlePrintCard = () => {
    window.print();
  };

  const handleManualRepublish = async () => {
    setIsVerifying(true);
    setVerifyError(null);
    const result = await republishAlbum(album, album.ownerId);
    if (result.success && result.verified) {
      const verifiedCheck = await verifyServerRecord(cleanGalleryId);
      setIsVerified(true);
      setServerRecord(verifiedCheck.record);
    } else {
      setVerifyError(result.error || 'Gagal mempublikasikan ulang ke database.');
    }
    setIsVerifying(false);
  };

  const handleTestQr = async () => {
    if (!qrDataUrl || !finalCustomerUrl) return;
    setIsTestingQr(true);
    try {
      const result = await verifyQRCodePayload(qrDataUrl, finalCustomerUrl);
      setQrVerification(result);
    } finally {
      setIsTestingQr(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 no-print">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-xs bg-blue-600"
            >
              <QrIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">QR Code Galeri Pelanggan</h3>
              <p className="text-xs text-slate-500 font-mono">ID: {cleanGalleryId}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Server Verification Banner */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {isVerifying ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                <span className="text-slate-600 font-medium">Memverifikasi database server cloud...</span>
              </>
            ) : isVerified ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-800 font-medium">Galeri Publik Aktif & Siap Diakses</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                <span className="text-rose-700 font-medium">{verifyError || 'Perlu sinkronisasi ulang'}</span>
              </>
            )}
          </div>

          {!isVerifying && (
            <button
              onClick={handleManualRepublish}
              className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Sinkronkan Ulang</span>
            </button>
          )}
        </div>

        {/* Tab switchers */}
        <div className="px-6 pt-4 pb-2 border-b border-slate-200 flex gap-2 no-print bg-white">
          <button
            onClick={() => setActiveTab('qr')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'qr'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            QR Standar (PNG)
          </button>
          <button
            onClick={() => setActiveTab('print_card')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'print_card'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Kartu Meja & Flyer Cetak</span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {activeTab === 'qr' ? (
            /* TAB 1: QR CODE DISPLAY */
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-white border-2 border-slate-200 rounded-2xl shadow-md text-center w-full max-w-sm">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR Code Galeri ${album.eventName}`}
                    className="w-56 h-56 sm:w-64 sm:h-64 object-contain mx-auto"
                  />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center text-slate-400 mx-auto">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  </div>
                )}
                <div className="mt-2 text-center">
                  <p className="font-bold text-slate-900 text-sm">{album.eventName}</p>
                  <p className="text-xs text-slate-500 font-medium">Klien: {album.customerName}</p>
                </div>
              </div>

              {/* Database & QR Payload Verification Box */}
              <div className="w-full p-3.5 bg-slate-900 text-slate-200 rounded-xl border border-slate-800 text-[11px] font-mono space-y-2">
                <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-slate-800 font-sans">
                  <span className="flex items-center gap-1.5 font-bold text-xs text-white">
                    <Database className="w-3.5 h-3.5 text-blue-400" />
                    DATABASE & QR VERIFICATION
                  </span>
                  <button
                    onClick={handleTestQr}
                    disabled={isTestingQr || !qrDataUrl}
                    className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-sans text-[10px] font-semibold transition cursor-pointer disabled:opacity-50"
                  >
                    {isTestingQr ? 'Testing...' : 'Test QR'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-slate-400">DATABASE STATUS: </span>
                    <span className={`font-bold ${isVerified ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {isVerified ? 'FOUND (200 OK)' : 'PENDING SYNC'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">STATUS: </span>
                    <span className="text-emerald-400 font-bold">
                      {album.isDeleted ? 'DISABLED' : 'PUBLISHED'}
                    </span>
                  </div>
                </div>

                <div className="truncate">
                  <span className="text-slate-400">DOCUMENT ID: </span>
                  <span className="text-cyan-300 font-bold">{cleanGalleryId}</span>
                </div>

                <div className="truncate">
                  <span className="text-slate-400">URL LINK: </span>
                  <span className="text-blue-300">{finalCustomerUrl}</span>
                </div>

                <div className="truncate">
                  <span className="text-slate-400">QR PAYLOAD: </span>
                  <span className="text-emerald-300">{qrVerification?.decodedUrl || finalCustomerUrl}</span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-xs">
                  <span>QR MATCH:</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                    qrVerification?.isMatch !== false
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-rose-950 text-rose-300 border border-rose-800'
                  }`}>
                    {qrVerification?.isMatch !== false ? 'YES (100% Identical)' : 'NO (MISMATCH!)'}
                  </span>
                </div>
              </div>

              {/* Password notice */}
              {album.isPasswordProtected && (
                <div className="w-full p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Lock className="w-4 h-4 text-amber-700" />
                    Galeri ini dilindungi PIN Klien:
                  </span>
                  <span className="font-mono font-bold text-sm bg-white px-2 py-0.5 rounded border border-amber-300">
                    {album.passwordHash}
                  </span>
                </div>
              )}

              {/* URL Display & Copy */}
              <div className="w-full space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-slate-700">Tautan Akses Pelanggan (Sama dengan QR):</label>
                  <button
                    onClick={() => setShowDomainEditor(!showDomainEditor)}
                    className="text-blue-600 hover:underline flex items-center gap-1 text-[11px]"
                  >
                    <Settings className="w-3 h-3" />
                    {showDomainEditor ? 'Tutup Kustomisasi' : 'Kustom Domain'}
                  </button>
                </div>

                {showDomainEditor && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                    <p className="text-slate-600 text-[11px]">
                      Gunakan domain atau subdomain sendiri (misal: <code>https://foto.studioku.com</code>):
                    </p>
                    <input
                      type="text"
                      value={customDomainInput}
                      onChange={(e) => setCustomDomainInput(e.target.value)}
                      placeholder="https://galeri.studioku.com"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <input
                    type="text"
                    readOnly
                    value={finalCustomerUrl}
                    className="w-full bg-transparent px-2.5 py-1 text-xs text-slate-700 font-mono focus:outline-none truncate"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs font-bold hover:bg-slate-100 transition shrink-0 flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: PRINT CARD / FLYER */
            <div className="space-y-4">
              <div 
                ref={printRef}
                className="p-6 bg-slate-900 text-white rounded-2xl text-center space-y-4 shadow-xl border border-slate-800 printable-area"
              >
                <div>
                  {(studioProfile.studioLogoUrl || studioProfile.logoUrl) ? (
                    <div className="h-10 max-w-[160px] mx-auto mb-2 flex items-center justify-center p-1 bg-white rounded-xl shadow-xs">
                      <img
                        src={studioProfile.studioLogoUrl || studioProfile.logoUrl}
                        alt={studioProfile.studioName}
                        className="max-h-full max-w-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : null}
                  <h4 className="text-base font-bold uppercase tracking-wider text-blue-400">
                    {studioProfile.studioName || 'Galeri Foto Studio'}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {studioProfile.tagline || 'Pindai QR Code untuk melihat & mengunduh foto Anda'}
                  </p>
                </div>

                <div className="bg-white p-3 rounded-xl inline-block shadow-inner mx-auto">
                  {qrDataUrl && (
                    <img
                      src={qrDataUrl}
                      alt="QR Code Cetak"
                      className="w-44 h-44 object-contain"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-lg font-bold text-white">{album.eventName}</p>
                  <p className="text-xs text-slate-400 font-medium">Khusus untuk {album.customerName}</p>
                  {(album.isPasswordProtected || album.pinEnabled) && (album.passwordHash || album.pinHash) && (
                    <p className="text-xs text-amber-300 font-mono font-bold mt-1">
                      PIN Akses: {album.passwordHash || album.pinHash}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800 text-[10px] text-slate-500 font-mono break-all">
                  URL: {finalCustomerUrl}
                </div>
              </div>

              <p className="text-xs text-slate-500 text-center">
                Kartu ini siap dicetak di kertas foto ukuran 4R atau kartu meja tamu.
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 no-print">
          <a
            href={finalCustomerUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-semibold"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Buka Langsung</span>
          </a>

          <div className="flex items-center gap-2">
            {activeTab === 'qr' ? (
              <button
                onClick={handleDownloadPNG}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Unduh PNG</span>
              </button>
            ) : (
              <button
                onClick={handlePrintCard}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Flyer (Print)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

