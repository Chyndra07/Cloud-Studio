import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from './hooks/useAuth';
import { useStudioData } from './hooks/useStudioData';
import { Album } from './types';
import { Sidebar } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { MobileNav } from './components/layout/MobileNav';
import { CreateAlbumModal } from './components/albums/CreateAlbumModal';
import { QRCodeModal } from './components/qr/QRCodeModal';
import { DashboardPage } from './pages/DashboardPage';
import { AlbumsPage } from './pages/AlbumsPage';
import { AlbumDetailPage } from './pages/AlbumDetailPage';
import { TrashPage } from './pages/TrashPage';
import { BrandingPage } from './pages/BrandingPage';
import { SettingsPage } from './pages/SettingsPage';
import { PublicGalleryPage } from './pages/PublicGalleryPage';
import { LicenseGuard } from './license/LicenseGuard';
import {
  Camera,
  HardDrive,
  QrCode,
  ShieldCheck,
  Zap,
  Globe,
  Lock,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

export default function App() {
  // Hash Routing State
  const [currentHash, setCurrentHash] = useState<string>(
    typeof window !== 'undefined' ? window.location.hash : ''
  );

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Determine if URL is a Public Gallery route (e.g. #/gallery/GFQ-XXXXXX)
  const publicGalleryId = useMemo(() => {
    const match = currentHash.match(/^#\/gallery\/([A-Za-z0-9\-_]+)/);
    return match ? match[1] : null;
  }, [currentHash]);

  // Auth Hook
  const {
    user,
    accessToken,
    isLoading: isAuthLoading,
    isDriveConnected,
    signIn,
    signOut,
    connectDrive,
    error: authError,
  } = useAuth();

  // Studio Data Hook
  const {
    profile,
    albums,
    trashItems,
    quota,
    isLoading: isDataLoading,
    isProcessing,
    error: studioError,
    refreshData,
    createNewAlbum,
    updateExistingAlbum,
    trashAlbum,
    restoreAlbum,
    deletePermanent,
    clearTrash,
    updateProfile,
  } = useStudioData(user, accessToken);

  // Admin Navigation State
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedAlbumForDetail, setSelectedAlbumForDetail] = useState<Album | null>(null);

  // Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [qrModalAlbum, setQrModalAlbum] = useState<Album | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  // Sync tab with hash if on admin routes
  useEffect(() => {
    if (!publicGalleryId) {
      if (currentHash === '#/albums') setCurrentTab('albums');
      else if (currentHash === '#/trash') setCurrentTab('trash');
      else if (currentHash === '#/branding') setCurrentTab('branding');
      else if (currentHash === '#/settings') setCurrentTab('settings');
      else if (currentHash === '#/' || currentHash === '#/dashboard' || currentHash === '') {
        if (currentTab !== 'album-detail') setCurrentTab('dashboard');
      }
    }
  }, [currentHash, publicGalleryId]);

  const handleSelectTab = (tab: string) => {
    setSelectedAlbumForDetail(null);
    setCurrentTab(tab);
    window.location.hash = `#/${tab === 'dashboard' ? '' : tab}`;
  };

  const handleOpenAlbumDetail = (album: Album) => {
    setSelectedAlbumForDetail(album);
    setCurrentTab('album-detail');
  };

  // 1. PUBLIC GALLERY CLIENT VIEW (No Login Required)
  if (publicGalleryId) {
    return (
      <PublicGalleryPage
        galleryId={publicGalleryId}
        onNavigateHome={() => {
          window.location.hash = '#/';
        }}
      />
    );
  }

  // 2. STUDIO ADMIN & LOGIN WRAPPED IN LICENSE GUARD
  const pageTitles: Record<string, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Dashboard Studio',
      subtitle: 'Ringkasan performa album, penyimpanan Google Drive, dan aksi cepat',
    },
    albums: {
      title: 'Album Pelanggan',
      subtitle: 'Daftar semua album foto, status PIN, masa berlaku, dan QR Code',
    },
    'album-detail': {
      title: selectedAlbumForDetail?.albumName || 'Detail Album',
      subtitle: `Gallery ID: ${selectedAlbumForDetail?.galleryId} • Pelanggan: ${selectedAlbumForDetail?.clientName}`,
    },
    trash: {
      title: 'Keranjang Sampah',
      subtitle: 'Daftar album yang dihapus sementara dan dapat dipulihkan',
    },
    branding: {
      title: 'Profil & Branding Studio',
      subtitle: 'Pengaturan logo, nama studio, nomor WhatsApp, dan identitas warna',
    },
    settings: {
      title: 'Pengaturan Sistem',
      subtitle: 'Konfigurasi URL publik GitHub Pages, Drive storage, dan status lisensi',
    },
  };

  const activeHeader = pageTitles[currentTab] || pageTitles.dashboard;

  return (
    <LicenseGuard
      user={user}
      isAuthLoading={isAuthLoading}
      onSignOut={signOut}
    >
      {({ license, refreshLicense, openDeveloperPanel }) => {
        // Unauthenticated Welcome / Login Screen
        if (!user) {
          return (
            <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-blue-500 selection:text-white">
              {/* Top Minimal Bar */}
              <header className="border-b border-slate-900 px-6 sm:px-12 py-5 flex items-center justify-between max-w-7xl mx-auto w-full">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h1 className="text-base font-extrabold text-white tracking-tight">GaleriFotoQR</h1>
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block">
                      Cloud Studio
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={openDeveloperPanel}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-semibold transition-all"
                  >
                    Dev License Panel
                  </button>
                  <span className="text-xs text-slate-400 hidden sm:inline">
                    Platform Manajemen Galeri & Google Drive Studio
                  </span>
                </div>
              </header>

              {/* Main Hero Card */}
              <main className="max-w-5xl mx-auto w-full px-6 py-12 flex-1 flex flex-col items-center justify-center text-center space-y-8">
                <div className="space-y-4 max-w-2xl">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs font-semibold text-blue-400">
                    <Zap className="w-3.5 h-3.5" />
                    Satu Akun Google = Satu Studio Foto Digital
                  </div>

                  <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                    Manajemen Galeri Foto & QR Code Berbasis Google Drive
                  </h2>

                  <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-xl mx-auto">
                    Simpan foto asli berkualitas tinggi tanpa kompresi file, buat album pelanggan instan, dan bagikan tautan & kartu QR Code tanpa perlu akun bagi pelanggan.
                  </p>
                </div>

                {/* Google Sign-in Action */}
                <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
                  {authError && (
                    <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2 text-left">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-bold text-white">Masuk ke Studio Foto Anda</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Otentikasi aman menggunakan akun Google & Google Drive
                    </p>
                  </div>

                  {/* Official GSI Material Style Google Sign In Button */}
                  <button
                    onClick={signIn}
                    className="w-full flex items-center justify-center gap-3 py-3.5 px-6 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl text-xs font-bold shadow-xl transition-all active:scale-95 group"
                  >
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                    <span>Masuk dengan Akun Google Studio</span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </button>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Dengan masuk, aplikasi akan meminta izin untuk membuat folder dan mengunggah foto ke Google Drive studio Anda secara aman.
                  </p>
                </div>

                {/* Feature Highlights Bento Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-4xl text-left pt-6">
                  <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                      <HardDrive className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white">Google Drive 100% Asli</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Foto diunggah dalam ukuran dan format biner asli tanpa kompresi apapun.
                    </p>
                  </div>

                  <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white">QR Code & Kartu Cetak</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Generate kartu cetak ber-branding studio & kode PIN galeri dalam satu klik.
                    </p>
                  </div>

                  <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                      <Globe className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white">GitHub Pages Ready</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Hash routing teruji 100% bebas 404 pada hosting statis maupun domain sendiri.
                    </p>
                  </div>
                </div>
              </main>

              {/* Footer */}
              <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
                GaleriFotoQR Cloud Studio • Solusi Manajemen Galeri Digital Studio Foto
              </footer>
            </div>
          );
        }

        // Authenticated Studio Admin Dashboard
        return (
          <div className="min-h-screen bg-slate-50 flex text-slate-900">
            {/* Desktop Sidebar */}
            <div className="hidden lg:block">
              <Sidebar
                currentTab={currentTab === 'album-detail' ? 'albums' : currentTab}
                onSelectTab={handleSelectTab}
                profile={profile}
                quota={quota}
                isDriveConnected={isDriveConnected}
                onConnectDrive={connectDrive}
                onSignOut={signOut}
              />
            </div>

            {/* Mobile Drawer */}
            <MobileNav
              isOpen={isMobileNavOpen}
              onClose={() => setIsMobileNavOpen(false)}
              currentTab={currentTab === 'album-detail' ? 'albums' : currentTab}
              onSelectTab={handleSelectTab}
              profile={profile}
              onSignOut={signOut}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
              <Navbar
                title={activeHeader.title}
                subtitle={activeHeader.subtitle}
                profile={profile}
                isDriveConnected={isDriveConnected}
                onOpenCreateAlbum={() => setIsCreateModalOpen(true)}
                onRefresh={refreshData}
                onToggleMobileMenu={() => setIsMobileNavOpen(true)}
                isRefreshing={isDataLoading}
              />

              <main className="p-4 sm:p-8 max-w-7xl w-full mx-auto flex-1">
                {/* Main View Router */}
                {currentTab === 'dashboard' && (
                  <DashboardPage
                    albums={albums}
                    profile={profile}
                    quota={quota}
                    isDriveConnected={isDriveConnected}
                    onOpenCreateAlbum={() => setIsCreateModalOpen(true)}
                    onOpenQR={(album) => setQrModalAlbum(album)}
                    onOpenAlbumDetail={handleOpenAlbumDetail}
                    onSelectTab={handleSelectTab}
                    onConnectDrive={connectDrive}
                  />
                )}

                {currentTab === 'albums' && (
                  <AlbumsPage
                    albums={albums}
                    profile={profile}
                    onOpenCreateAlbum={() => setIsCreateModalOpen(true)}
                    onOpenQR={(album) => setQrModalAlbum(album)}
                    onOpenAlbumDetail={handleOpenAlbumDetail}
                    onTrashAlbum={trashAlbum}
                    onUpdateAlbum={updateExistingAlbum}
                  />
                )}

                {currentTab === 'album-detail' && selectedAlbumForDetail && (
                  <AlbumDetailPage
                    album={selectedAlbumForDetail}
                    accessToken={accessToken || ''}
                    studioProfile={profile}
                    onBack={() => handleSelectTab('albums')}
                    onOpenQR={(album) => setQrModalAlbum(album)}
                    onUpdateAlbum={async (updated) => {
                      await updateExistingAlbum(updated);
                      setSelectedAlbumForDetail(updated);
                    }}
                    onTrashAlbum={(id) => {
                      trashAlbum(id);
                      handleSelectTab('albums');
                    }}
                  />
                )}

                {currentTab === 'trash' && (
                  <TrashPage
                    trashItems={trashItems}
                    onRestore={restoreAlbum}
                    onDeletePermanent={deletePermanent}
                    onClearTrash={clearTrash}
                    isProcessing={isProcessing}
                  />
                )}

                {currentTab === 'branding' && (
                  <BrandingPage
                    profile={profile}
                    onSaveProfile={updateProfile}
                    isProcessing={isProcessing}
                  />
                )}

                {currentTab === 'settings' && (
                  <SettingsPage
                    profile={profile}
                    quota={quota}
                    isDriveConnected={isDriveConnected}
                    albums={albums}
                    license={license}
                    onConnectDrive={connectDrive}
                    onRefreshData={refreshData}
                    onRefreshLicense={refreshLicense}
                    onOpenDeveloperPanel={openDeveloperPanel}
                  />
                )}
              </main>
            </div>

            {/* Create Album Modal */}
            <CreateAlbumModal
              isOpen={isCreateModalOpen}
              onClose={() => setIsCreateModalOpen(false)}
              onSubmit={async (params) => {
                const newAlbum = await createNewAlbum(params);
                setSelectedAlbumForDetail(newAlbum);
                setCurrentTab('album-detail');
              }}
              isProcessing={isProcessing}
            />

            {/* QR Code & Printable Card Modal */}
            <QRCodeModal
              isOpen={Boolean(qrModalAlbum)}
              onClose={() => setQrModalAlbum(null)}
              album={qrModalAlbum}
              studioProfile={profile}
            />
          </div>
        );
      }}
    </LicenseGuard>
  );
}
