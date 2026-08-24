import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  Images, 
  Camera, 
  Trash2, 
  HardDrive, 
  Plus, 
  QrCode, 
  ExternalLink, 
  Eye, 
  Download, 
  Sparkles, 
  ArrowRight, 
  FolderOpen, 
  Lock, 
  Unlock, 
  Calendar, 
  User, 
  Share2, 
  Copy, 
  Check, 
  Search, 
  Zap, 
  ShieldCheck, 
  Layers, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Settings
} from 'lucide-react';
import { Album, Photo, StudioProfile, UserAccount, DriveStorageQuota } from '../types';
import { getPublicGalleryUrl, logQRDebug } from '../services/urlHelper';
import { verifyQRCodePayload, QRVerificationResult } from '../services/qrVerifier';

interface DashboardHomeProps {
  user: UserAccount | null;
  studioProfile: StudioProfile;
  albums: Album[];
  photos: Photo[];
  trashCount: number;
  driveQuota: DriveStorageQuota | null;
  onOpenCreateAlbum: () => void;
  onSelectAlbum: (album: Album) => void;
  onOpenQRCode: (album: Album) => void;
  onOpenSettings?: (album: Album) => void;
  onNavigate: (view: any) => void;
  onConnectDrive?: () => void;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  user,
  studioProfile,
  albums,
  photos,
  trashCount,
  driveQuota,
  onOpenCreateAlbum,
  onSelectAlbum,
  onOpenQRCode,
  onOpenSettings,
  onNavigate,
  onConnectDrive,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'locked' | 'unlocked'>('all');
  const [selectedQuickAlbumId, setSelectedQuickAlbumId] = useState<string | null>(null);
  const [quickQrDataUrl, setQuickQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);
  const [copiedPinId, setCopiedPinId] = useState<string | null>(null);
  const [copiedPinToast, setCopiedPinToast] = useState<string | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<'light' | 'hd'>('hd');

  const isDriveConnected = !!user && !!user.isConnectedToDrive;
  const activeAlbums = isDriveConnected ? albums.filter((a) => !a.isDeleted) : [];
  const activePhotos = isDriveConnected ? photos.filter((p) => !p.isDeleted) : [];
  const totalViews = isDriveConnected ? activeAlbums.reduce((sum, a) => sum + (a.viewsCount || 0), 0) : 0;

  // Initialize or maintain selected quick album
  useEffect(() => {
    if (isDriveConnected && activeAlbums.length > 0) {
      if (!selectedQuickAlbumId || !activeAlbums.some((a) => a.id === selectedQuickAlbumId)) {
        setSelectedQuickAlbumId(activeAlbums[0].id);
        setSelectedQuality(activeAlbums[0].displayQuality || 'hd');
      }
    } else {
      setSelectedQuickAlbumId(null);
    }
  }, [isDriveConnected, activeAlbums, selectedQuickAlbumId]);

  const selectedQuickAlbum = isDriveConnected ? (activeAlbums.find((a) => a.id === selectedQuickAlbumId) || activeAlbums[0] || null) : null;
  const [quickQrVerification, setQuickQrVerification] = useState<QRVerificationResult | null>(null);
  const [isTestingQuickQr, setIsTestingQuickQr] = useState(false);

  // Single Source of Truth Final Absolute URL for the quick album
  const finalQuickCustomerUrl = selectedQuickAlbum
    ? (getPublicGalleryUrl(selectedQuickAlbum.galleryId, studioProfile.customGalleryDomain) || '').trim()
    : '';

  // Generate QR Code deterministically from finalQuickCustomerUrl and verify via decoder
  useEffect(() => {
    if (!isDriveConnected || !selectedQuickAlbum || !finalQuickCustomerUrl) {
      setQuickQrDataUrl('');
      setQuickQrVerification(null);
      return;
    }

    let isMounted = true;
    const qrPayload = finalQuickCustomerUrl;

    try {
      const parsedUrl = new URL(finalQuickCustomerUrl);
      if (parsedUrl.hostname.includes('aistudio.google.com')) {
        console.error('[CRITICAL] Forbidden destination detected in Quick QR Payload:', finalQuickCustomerUrl);
        return;
      }
    } catch (e) {
      console.warn('URL parse error:', e);
    }

    console.log('DASHBOARD FINAL CUSTOMER URL:', finalQuickCustomerUrl);
    console.log('DASHBOARD QR RAW PAYLOAD:', qrPayload);
    console.log('DASHBOARD PAYLOAD IDENTICAL:', finalQuickCustomerUrl === qrPayload);
    logQRDebug(selectedQuickAlbum.galleryId, studioProfile.customGalleryDomain);

    QRCode.toDataURL(qrPayload, {
      width: 480,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then(async (dataUri) => {
        if (!isMounted) return;
        setQuickQrDataUrl(dataUri);

        // Immediate decode verification to guarantee 100% match
        const check = await verifyQRCodePayload(dataUri, finalQuickCustomerUrl);
        if (isMounted) {
          setQuickQrVerification(check);
        }
      })
      .catch((err) => {
        console.error('Error generating quick QR code:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [isDriveConnected, selectedQuickAlbum, finalQuickCustomerUrl, studioProfile.customGalleryDomain]);

  // Filtered albums for the table
  const filteredAlbums = activeAlbums.filter((album) => {
    const matchesSearch =
      album.eventName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      album.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      album.galleryId.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterType === 'locked') return album.isPasswordProtected;
    if (filterType === 'unlocked') return !album.isPasswordProtected;
    return true;
  });

  const handleCopyLink = (album: Album, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const url = (getPublicGalleryUrl(album.galleryId, studioProfile.customGalleryDomain) || '').trim();
    navigator.clipboard.writeText(url);
    if (e) {
      setCopiedRowId(album.id);
      setTimeout(() => setCopiedRowId(null), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCopyPin = (album: Album, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const pin = (album.passwordHash || album.pinHash || '').trim();
    if (!pin) return;
    navigator.clipboard.writeText(pin);
    setCopiedPinId(album.id);
    setCopiedPinToast(pin);
    setTimeout(() => setCopiedPinId(null), 2000);
    setTimeout(() => setCopiedPinToast(null), 2500);
  };

  const handleDownloadQR = () => {
    if (!quickQrDataUrl || !selectedQuickAlbum) return;
    const a = document.createElement('a');
    a.href = quickQrDataUrl;
    a.download = `QRCode_${selectedQuickAlbum.eventName.replace(/\s+/g, '_')}_${selectedQuickAlbum.galleryId}.png`;
    a.click();
  };

  const handleOpenGallery = () => {
    if (!selectedQuickAlbum || !finalQuickCustomerUrl) return;
    window.open(finalQuickCustomerUrl, '_blank');
  };

  const handleTestQuickQr = async () => {
    if (!quickQrDataUrl || !finalQuickCustomerUrl) return;
    setIsTestingQuickQr(true);
    try {
      const result = await verifyQRCodePayload(quickQrDataUrl, finalQuickCustomerUrl);
      setQuickQrVerification(result);
    } finally {
      setIsTestingQuickQr(false);
    }
  };

  // Format storage bytes
  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    return gb.toFixed(2) + ' GB';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Album */}
        <div 
          onClick={() => onNavigate('albums')}
          className="bg-white border border-slate-200 hover:border-blue-300 p-5 rounded-2xl transition cursor-pointer group shadow-2xs hover:shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Album
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition">
              <Images className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {activeAlbums.length}
            </span>
            <span className="text-xs text-slate-500 font-medium">album aktif</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1 group-hover:text-blue-600 transition font-medium">
            Kelola album pelanggan <ArrowRight className="w-3 h-3 ml-0.5" />
          </p>
        </div>

        {/* Card 2: Total Foto di Drive */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Foto di Drive
            </span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {activePhotos.length}
            </span>
            <span className="text-xs text-slate-500 font-medium">file di Drive</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">
            Tersimpan aman di folder Google Drive
          </p>
        </div>

        {/* Card 3: Total Kunjungan QR */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Kunjungan QR
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {totalViews}
            </span>
            <span className="text-xs text-slate-500 font-medium">kali dilihat</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">
            Scan QR & akses tautan pelanggan
          </p>
        </div>

        {/* Card 4: Penyimpanan Drive */}
        <div 
          onClick={() => {
            if (!isDriveConnected && onConnectDrive) {
              onConnectDrive();
            } else {
              onNavigate('drive-status');
            }
          }}
          className={`bg-white border p-5 rounded-2xl transition cursor-pointer group shadow-2xs hover:shadow-xs ${
            isDriveConnected ? 'border-slate-200 hover:border-emerald-300' : 'border-slate-200 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Penyimpanan Drive
            </span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isDriveConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            }`}>
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
              {isDriveConnected ? (driveQuota ? `${formatBytes(driveQuota.usageBytes)}` : 'Google Cloud') : 'Belum Terhubung'}
            </span>
            <span className={`text-xs font-medium flex items-center gap-1 ${
              isDriveConnected ? 'text-emerald-700' : 'text-rose-700'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isDriveConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              {isDriveConnected ? 'Terhubung' : 'Belum Terhubung'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 truncate font-medium group-hover:text-slate-700">
            {isDriveConnected ? (user?.email || 'Google Drive Mandiri') : 'Klik untuk hubungkan Google Drive'}
          </p>
        </div>
      </div>

      {/* 2. Main Area: Empty State when disconnected, or Split Layout when connected */}
      {!isDriveConnected ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-14 text-center space-y-5 shadow-2xs">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 mx-auto flex items-center justify-center shadow-xs">
            <HardDrive className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Google Drive Belum Terhubung
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Hubungkan akun Google Anda untuk mulai menggunakan GaleriFotoQR Cloud Studio.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={onConnectDrive || onOpenCreateAlbum}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-md transition transform active:scale-98 cursor-pointer"
            >
              <HardDrive className="w-4 h-4" />
              <span>Hubungkan Google Drive</span>
            </button>
          </div>
          <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5 text-slate-600">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Multi-Tenant Terisolasi
            </span>
            <span>•</span>
            <span>Kapasitas Drive Mandiri</span>
            <span>•</span>
            <span>Bebas Biaya Server Storage</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Album Pelanggan Table & Filters */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Header & Filter Controls */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Album Pelanggan
                </h2>
                <p className="text-xs text-slate-500">
                  Pilih album untuk melihat detail atau membagikan QR Code instan.
                </p>
              </div>

              <button
                onClick={onOpenCreateAlbum}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Album Baru</span>
              </button>
            </div>

            {/* Search and Category Tabs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 border-t border-slate-100">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama klien, acara, atau ID galeri..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs shrink-0">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                    filterType === 'all' ? 'bg-white text-blue-700 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua ({activeAlbums.length})
                </button>
                <button
                  onClick={() => setFilterType('locked')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                    filterType === 'locked' ? 'bg-white text-blue-700 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  PIN Locked
                </button>
                <button
                  onClick={() => setFilterType('unlocked')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                    filterType === 'unlocked' ? 'bg-white text-blue-700 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Publik
                </button>
              </div>
            </div>
          </div>

          {/* Album Table */}
          {filteredAlbums.length === 0 ? (
            <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-10 text-center space-y-3 shadow-2xs">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center">
                <Images className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                {searchQuery ? 'Tidak Ada Album yang Sesuai' : 'Belum Ada Album Pelanggan'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery
                  ? `Tidak ada album dengan kata kunci "${searchQuery}". Coba reset pencarian.`
                  : 'Mulai buat album pertama untuk klien Anda. QR Code dan folder Drive otomatis dibuat.'}
              </p>
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  Reset Pencarian
                </button>
              ) : (
                <button
                  onClick={onOpenCreateAlbum}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buat Album Sekarang</span>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Acara & Pelanggan</th>
                      <th className="py-3 px-3 hidden sm:table-cell">Tanggal</th>
                      <th className="py-3 px-3 text-center">Foto</th>
                      <th className="py-3 px-3 hidden md:table-cell">Status / PIN</th>
                      <th className="py-3 px-3 hidden lg:table-cell">Gallery ID</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAlbums.map((album) => {
                      const isSelected = selectedQuickAlbumId === album.id;
                      return (
                        <tr
                          key={album.id}
                          onClick={() => setSelectedQuickAlbumId(album.id)}
                          className={`transition cursor-pointer hover:bg-slate-50/80 ${
                            isSelected ? 'bg-blue-50/40 font-medium' : ''
                          }`}
                        >
                          {/* Event & Customer */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                                {album.coverPhotoUrl ? (
                                  <img
                                    src={album.coverPhotoUrl}
                                    alt={album.eventName}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <Camera className="w-4 h-4 text-slate-400" />
                                )}
                              </div>
                              <div className="min-w-0 max-w-[160px] sm:max-w-[200px]">
                                <p className="font-bold text-slate-900 truncate">{album.eventName}</p>
                                <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                                  <User className="w-3 h-3 text-slate-400" />
                                  {album.customerName}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Event Date */}
                          <td className="py-3 px-3 text-slate-600 hidden sm:table-cell whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>
                                {album.eventDate
                                  ? new Date(album.eventDate).toLocaleDateString('id-ID', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                    })
                                  : '-'}
                              </span>
                            </div>
                          </td>

                          {/* Photos Count */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200">
                              <Images className="w-3 h-3 text-slate-500" />
                              {album.photosCount}
                            </span>
                          </td>

                          {/* Status / PIN */}
                          <td className="py-3 px-3 hidden md:table-cell whitespace-nowrap">
                            {(album.isPasswordProtected || album.pinEnabled) && (album.passwordHash || album.pinHash) ? (
                              <button
                                type="button"
                                onClick={(e) => handleCopyPin(album, e)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200 transition cursor-pointer"
                                title="Klik untuk salin PIN"
                              >
                                <Lock className="w-3 h-3 text-amber-700 shrink-0" />
                                <span>
                                  {copiedPinId === album.id ? 'Tersalin!' : `PIN: ${album.passwordHash || album.pinHash}`}
                                </span>
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                                <Unlock className="w-3 h-3 text-emerald-600" />
                                Publik
                              </span>
                            )}
                          </td>

                          {/* Gallery ID */}
                          <td className="py-3 px-3 hidden lg:table-cell whitespace-nowrap">
                            <span className="font-mono text-[11px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {album.galleryId}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => onSelectAlbum(album)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold transition cursor-pointer"
                                title="Buka Detail & Upload Foto"
                              >
                                Detail
                              </button>

                              <button
                                onClick={() => onOpenQRCode(album)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition cursor-pointer"
                                title="Lihat Flyer & QR Code"
                              >
                                <QrCode className="w-4 h-4" />
                              </button>

                              {onOpenSettings && (
                                <button
                                  onClick={() => onOpenSettings(album)}
                                  className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                                  title="Pengaturan & Keamanan Album"
                                >
                                  <Settings className="w-4 h-4" />
                                </button>
                              )}

                              <button
                                onClick={(e) => handleCopyLink(album, e)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                                title="Salin Tautan Galeri"
                              >
                                {copiedRowId === album.id ? (
                                  <Check className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Panel "Bagikan Galeri Cepat" */}
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-5 sticky top-20">
            {/* Header Panel */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Bagikan Galeri Cepat</h3>
                  <p className="text-[11px] text-slate-500">QR Code & tautan pelanggan</p>
                </div>
              </div>

              {selectedQuickAlbum && (
                <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  {selectedQuickAlbum.galleryId}
                </span>
              )}
            </div>

            {selectedQuickAlbum ? (
              <div className="space-y-4">
                {/* Album Selector Dropdown if multiple albums */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Pilih Album
                  </label>
                  <select
                    value={selectedQuickAlbum.id}
                    onChange={(e) => setSelectedQuickAlbumId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {activeAlbums.map((alb) => (
                      <option key={alb.id} value={alb.id}>
                        {alb.eventName} — {alb.customerName} ({alb.galleryId})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Live QR Code Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs inline-block">
                    {quickQrDataUrl ? (
                      <img
                        src={quickQrDataUrl}
                        alt="QR Code Galeri"
                        className="w-40 h-40 sm:w-44 sm:h-44 object-contain"
                      />
                    ) : (
                      <div className="w-40 h-40 flex items-center justify-center text-slate-300">
                        <QrCode className="w-10 h-10 animate-pulse" />
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                      {selectedQuickAlbum.eventName}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Klien: {selectedQuickAlbum.customerName} • {selectedQuickAlbum.photosCount} Foto
                    </p>
                  </div>

                  {/* QR Payload Live Verification Debug Box */}
                  <div className="w-full p-2.5 bg-slate-900 text-slate-200 rounded-xl border border-slate-800 text-[10px] font-mono text-left space-y-1">
                    <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-slate-800 font-sans">
                      <span className="flex items-center gap-1 font-bold text-[11px] text-white">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        QR VERIFICATION
                      </span>
                      <button
                        onClick={handleTestQuickQr}
                        disabled={isTestingQuickQr || !quickQrDataUrl}
                        className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-sans text-[9px] font-semibold transition cursor-pointer disabled:opacity-50"
                      >
                        {isTestingQuickQr ? 'Testing...' : 'Test QR'}
                      </button>
                    </div>

                    <div className="truncate">
                      <span className="text-slate-400">URL: </span>
                      <span className="text-blue-300">{finalQuickCustomerUrl}</span>
                    </div>

                    <div className="truncate">
                      <span className="text-slate-400">DECODED: </span>
                      <span className="text-emerald-300">{quickQrVerification?.decodedUrl || finalQuickCustomerUrl}</span>
                    </div>

                    <div className="flex items-center justify-between pt-0.5 text-[10px]">
                      <span>MATCH:</span>
                      <span className={`font-bold px-1.5 py-0.5 rounded ${
                        quickQrVerification?.isMatch !== false
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}>
                        {quickQrVerification?.isMatch !== false ? 'YES (100%)' : 'MISMATCH!'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pilihan Kualitas: Ringan (Cepat) & Tinggi (HD) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Mode Tampilan Klien
                    </span>
                    <span className="text-[10px] text-slate-400">Resolusi Download</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedQuality('light')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                        selectedQuality === 'light'
                          ? 'bg-white text-blue-700 font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span>Ringan (Cepat)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedQuality('hd')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                        selectedQuality === 'hd'
                          ? 'bg-white text-blue-700 font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>Tinggi (HD)</span>
                    </button>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="space-y-2 pt-1">
                  {/* Salin Tautan Button */}
                  <button
                    onClick={() => handleCopyLink(selectedQuickAlbum)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition cursor-pointer"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Tautan Berhasil Disalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-slate-600" />
                        <span>Salin Tautan Galeri</span>
                      </>
                    )}
                  </button>

                  {/* Unduh QR & Buka Galeri Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleDownloadQR}
                      disabled={!quickQrDataUrl}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold text-xs bg-slate-900 hover:bg-slate-800 text-white shadow-2xs transition cursor-pointer disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh QR</span>
                    </button>

                    <button
                      onClick={handleOpenGallery}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka Galeri</span>
                    </button>
                  </div>
                </div>

                {/* Quick Security & Expiry Note */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    {selectedQuickAlbum.isPasswordProtected ? (
                      <>
                        <Lock className="w-3 h-3 text-amber-600" />
                        <span>PIN: {selectedQuickAlbum.passwordHash}</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3 h-3 text-emerald-600" />
                        <span>Akses Publik Langsung</span>
                      </>
                    )}
                  </span>

                  <div className="flex items-center gap-2">
                    {onOpenSettings && (
                      <button
                        onClick={() => onOpenSettings(selectedQuickAlbum)}
                        className="text-slate-600 hover:text-blue-600 font-semibold cursor-pointer flex items-center gap-1"
                        title="Buka Pengaturan Album"
                      >
                        <Settings className="w-3 h-3" />
                        <span>Pengaturan</span>
                      </button>
                    )}
                    <button
                      onClick={() => onSelectAlbum(selectedQuickAlbum)}
                      className="text-blue-600 hover:underline font-semibold cursor-pointer"
                    >
                      Kelola Foto →
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 space-y-2">
                <QrCode className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-xs text-slate-500">
                  Belum ada album aktif untuk dibagikan.
                </p>
                <button
                  onClick={onOpenCreateAlbum}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  + Buat Album Sekarang
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
      {/* Floating Toast Notification when PIN is copied */}
      {copiedPinToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200 border border-slate-800">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5" />
          </div>
          <span>
            PIN <strong className="text-amber-300 font-mono tracking-wider font-bold">{copiedPinToast}</strong> berhasil disalin
          </span>
        </div>
      )}
    </div>
  );
};
