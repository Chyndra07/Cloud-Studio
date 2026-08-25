import React, { useState, useEffect } from 'react';
import { 
  ViewMode, 
  UserAccount, 
  StudioProfile, 
  Album, 
  Photo, 
  DriveStorageQuota 
} from './types';
import { 
  initializeStorage, 
  DEFAULT_STUDIO_PROFILE,
  getStudioProfile, 
  saveStudioProfile,
  fetchRemoteStudioProfile,
  getAlbumsForOwner, 
  getAllPhotosForOwner, 
  getTrashForOwner, 
  createAlbum, 
  updateAlbum,
  moveAlbumToTrash, 
  restoreAlbumFromTrash, 
  permanentlyDeleteAlbum, 
  addPhotosToAlbum, 
  movePhotoToTrash, 
  restorePhotoFromTrash, 
  permanentlyDeletePhoto, 
  emptyTrash,
  syncPublicGalleryToServer,
  syncAllTenantsToServer
} from './services/storageService';
import { 
  getActiveUserSession, 
  saveActiveUserSession, 
  clearUserSession, 
  getStoredUserToken, 
  requestGoogleDriveAuth,
  checkAndHandleRedirectResult
} from './services/googleAuth';
import { 
  getDriveStorageQuota, 
  initAppDriveStructure 
} from './services/googleDrive';

import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DashboardHome } from './components/DashboardHome';
import { AlbumList } from './components/AlbumList';
import { AlbumDetail } from './components/AlbumDetail';
import { CreateAlbumModal } from './components/CreateAlbumModal';
import { UploadFolderModal } from './components/UploadFolderModal';
import { AlbumSettingsModal } from './components/AlbumSettingsModal';
import { QRCodeModal } from './components/QRCodeModal';
import { DriveStatusView } from './components/DriveStatusView';
import { BrandingSettings } from './components/BrandingSettings';
import { TrashBinView } from './components/TrashBinView';
import { AdminSaaSDashboard } from './components/AdminSaaSDashboard';
import { HelpAndGuide } from './components/HelpAndGuide';
import { AuthModal } from './components/AuthModal';
import { PublicCustomerGallery } from './components/PublicCustomerGallery';
import { ErrorBoundary } from './components/ErrorBoundary';
import { parseGallerySlugFromLocation } from './services/urlHelper';

export default function App() {
  // Initialize storage seeds & handle OAuth Redirect Result
  useEffect(() => {
    initializeStorage();

    // Check if returning from a Google OAuth Redirect sign-in flow (Skipped on Customer routes)
    const isCustomerRoute = Boolean(parseGallerySlugFromLocation());
    if (isCustomerRoute) {
      return;
    }

    checkAndHandleRedirectResult()
      .then(async (redirectAuth) => {
        if (redirectAuth) {
          const { accessToken, userInfo } = redirectAuth;
          let driveRootFolderId: string | undefined = undefined;
          let driveAlbumFolderId: string | undefined = undefined;

          try {
            const driveInit = await initAppDriveStructure(accessToken);
            driveRootFolderId = driveInit.rootFolderId;
            driveAlbumFolderId = driveInit.albumsFolderId;
          } catch (err: any) {
            console.warn('Drive structure initialization warning on redirect:', err?.message);
          }

          const userAccount: UserAccount = {
            id: userInfo.id,
            email: userInfo.email,
            name: userInfo.name,
            avatarUrl: userInfo.picture,
            accessToken,
            tokenExpiresAt: Date.now() + 3600 * 1000,
            isConnectedToDrive: true,
            driveRootFolderId,
            driveAlbumFolderId,
            role: 'studio_owner',
            subscriptionTier: 'pro',
            subscriptionStatus: 'active',
            createdAt: new Date().toISOString(),
          };

          saveActiveUserSession(userAccount);
          setCurrentUser(userAccount);
          setIsAuthModalOpen(false);
        }
      })
      .catch((e) => {
        console.warn('OAuth redirect check caught error:', e);
      });
  }, []);

  // Hash / Route detection for public customer gallery: #gallery/SLUG, ?gallery=SLUG, /gallery/SLUG
  const [publicGallerySlug, setPublicGallerySlug] = useState<string | null>(() => {
    return parseGallerySlugFromLocation();
  });

  useEffect(() => {
    const handleUrlChange = () => {
      const slug = parseGallerySlugFromLocation();
      setPublicGallerySlug(slug);
    };

    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  // Active authenticated user / tenant
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    return getActiveUserSession();
  });

  // Sync Studio OAuth Token to Backend for fast 100% original binary downloads
  useEffect(() => {
    if (currentUser?.accessToken && currentUser?.id) {
      fetch('/api/studio/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId: currentUser.id,
          token: currentUser.accessToken,
          expiresAt: currentUser.tokenExpiresAt || Date.now() + 3600 * 1000,
        }),
      }).catch(() => {});
    }
  }, [currentUser]);

  // Studio profile & branding
  const [studioProfile, setStudioProfile] = useState<StudioProfile>(() => {
    const initialUser = getActiveUserSession();
    return initialUser ? getStudioProfile(initialUser.id) : DEFAULT_STUDIO_PROFILE;
  });

  // Navigation view
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

  // Albums & photos state for current tenant
  const [albums, setAlbums] = useState<Album[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [trashAlbums, setTrashAlbums] = useState<Album[]>([]);
  const [trashPhotos, setTrashPhotos] = useState<Photo[]>([]);
  const [driveQuota, setDriveQuota] = useState<DriveStorageQuota | null>(null);

  // Modals
  const [isCreateAlbumOpen, setIsCreateAlbumOpen] = useState(false);
  const [isUploadFolderOpen, setIsUploadFolderOpen] = useState(false);
  const [uploadFolderTargetAlbumId, setUploadFolderTargetAlbumId] = useState<string | undefined>(undefined);
  const [activeQRAlbum, setActiveQRAlbum] = useState<Album | null>(null);
  const [activeSettingsAlbum, setActiveSettingsAlbum] = useState<Album | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // PWA Install prompt
  const [deferredPwaPrompt, setDeferredPwaPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPwaPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallPwa = async () => {
    if (!deferredPwaPrompt) return;
    deferredPwaPrompt.prompt();
    const choice = await deferredPwaPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPwaPrompt(null);
  };

  // Reload current tenant's data whenever currentUser changes
  const refreshTenantData = () => {
    if (!currentUser || !currentUser.isConnectedToDrive) {
      setAlbums([]);
      setPhotos([]);
      setTrashAlbums([]);
      setTrashPhotos([]);
      setDriveQuota(null);
      if (currentUser) {
        setStudioProfile(getStudioProfile(currentUser.id));
      } else {
        setStudioProfile(DEFAULT_STUDIO_PROFILE);
      }
      return;
    }
    const currentAlbums = getAlbumsForOwner(currentUser.id);
    const currentPhotos = getAllPhotosForOwner(currentUser.id);
    const trash = getTrashForOwner(currentUser.id);
    const profile = getStudioProfile(currentUser.id);

    setAlbums(currentAlbums);
    setPhotos(currentPhotos);
    setTrashAlbums(trash.albums);
    setTrashPhotos(trash.photos);
    setStudioProfile(profile);

    // Sync remote profile in background if available
    fetchRemoteStudioProfile(currentUser.id).then((remoteProf) => {
      if (remoteProf) {
        setStudioProfile(remoteProf);
      }
    }).catch(() => {});

    // If active Google Drive token exists, query real quota
    const token = getStoredUserToken(currentUser.id) || currentUser.accessToken;
    if (token && currentUser.isConnectedToDrive) {
      getDriveStorageQuota(token)
        .then((quota) => setDriveQuota(quota))
        .catch(() => {
          // Graceful fallback
        });
    }
  };

  useEffect(() => {
    refreshTenantData();
  }, [currentUser]);

  // Handle switching studio workspace
  const handleSwitchStudio = (newStudioUser: UserAccount) => {
    saveActiveUserSession(newStudioUser);
    setCurrentUser(newStudioUser);
    setSelectedAlbum(null);
    setCurrentView('dashboard');
  };

  // Handle user logout
  const handleLogout = async () => {
    await clearUserSession();
    setCurrentUser(null);
    setAlbums([]);
    setPhotos([]);
    setTrashAlbums([]);
    setTrashPhotos([]);
    setStudioProfile(DEFAULT_STUDIO_PROFILE);
    setDriveQuota(null);
    setSelectedAlbum(null);
    setCurrentView('dashboard');
    setIsAuthModalOpen(true);
  };

  // Handle Google Drive connect / reconnect
  const handleConnectDrive = async () => {
    try {
      const { accessToken, userInfo } = await requestGoogleDriveAuth();
      const driveInit = await initAppDriveStructure(accessToken);

      const updatedUser: UserAccount = {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        avatarUrl: userInfo.picture,
        accessToken,
        tokenExpiresAt: Date.now() + 3600 * 1000,
        isConnectedToDrive: true,
        driveRootFolderId: driveInit.rootFolderId,
        driveAlbumFolderId: driveInit.albumsFolderId,
        role: 'studio_owner',
        subscriptionTier: 'pro',
        subscriptionStatus: 'active',
        createdAt: new Date().toISOString(),
      };

      saveActiveUserSession(updatedUser);
      setCurrentUser(updatedUser);
      setIsAuthModalOpen(false);
      refreshTenantData();
    } catch (err: any) {
      alert(err.message || 'Gagal menghubungkan Google Drive.');
    }
  };

  // Handle saving branding profile
  // Simpan profil pengguna aktif terlebih dahulu agar UI tidak menunggu
  // sinkronisasi seluruh tenant. Sinkronisasi global dijalankan di background.
  const handleSaveProfile = async (updatedProfile: StudioProfile) => {
    if (!currentUser) {
      throw new Error('Pengguna tidak aktif. Silakan login kembali.');
    }

    // Penyimpanan profil utama untuk pengguna aktif.
    await Promise.resolve(saveStudioProfile(currentUser.id, updatedProfile));

    // Perbarui UI segera setelah profil utama berhasil disimpan.
    setStudioProfile(updatedProfile);

    // Sinkronisasi tambahan tidak boleh menahan tombol "Simpan".
    void syncAllTenantsToServer().catch((err: any) => {
      console.warn(
        '[BACKGROUND_TENANT_SYNC_WARNING] Profil sudah tersimpan, tetapi sinkronisasi tambahan gagal:',
        err?.message || err
      );
    });
  };

  // Handle creating a new album
  const handleCreateAlbum = async (
    albumData: Omit<
      Album,
      'id' | 'galleryId' | 'ownerId' | 'photosCount' | 'viewsCount' | 'downloadsCount' | 'isDeleted' | 'createdAt' | 'updatedAt'
    >
  ): Promise<Album> => {
    if (!currentUser) throw new Error('Pengguna tidak aktif.');
    const newAlb = createAlbum(currentUser.id, albumData);
    await syncPublicGalleryToServer(newAlb, [], studioProfile);
    refreshTenantData();
    return newAlb;
  };

  // Handle updating an existing album
  const handleUpdateAlbum = async (albumId: string, updates: Partial<Album>) => {
    if (!currentUser) throw new Error('Pengguna tidak aktif.');
    const updated = updateAlbum(currentUser.id, albumId, updates);
    refreshTenantData();
    if (selectedAlbum && selectedAlbum.id === albumId) {
      setSelectedAlbum(updated);
    }
    if (activeSettingsAlbum && activeSettingsAlbum.id === albumId) {
      setActiveSettingsAlbum(updated);
    }
  };

  // If viewing a public customer gallery (via QR code scan or link)
  if (publicGallerySlug) {
    return (
      <ErrorBoundary
        fallbackTitle="Memuat Galeri Pelanggan"
        fallbackMessage="Terjadi kendala saat memuat antarmuka galeri foto. Silakan muat ulang halaman."
      >
        <PublicCustomerGallery
          galleryId={publicGallerySlug}
          onBackToStudio={() => {
            if (window.location.hash) {
              window.location.hash = '';
            }
            if (window.location.pathname.startsWith('/gallery')) {
              window.history.pushState(null, '', '/');
            }
            setPublicGallerySlug(null);
          }}
        />
      </ErrorBoundary>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-slate-900 selection:text-white">
      {/* Top Navigation Bar */}
      <Navbar
        user={currentUser}
        studioProfile={studioProfile}
        onLogout={handleLogout}
        onSwitchStudio={handleSwitchStudio}
        onOpenDriveStatus={() => setCurrentView('drive-status')}
        onOpenAdminSaaS={() => setCurrentView('admin-saas')}
        onOpenCreateAlbum={() => setIsCreateAlbumOpen(true)}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        isInstallable={isInstallable}
        onInstallPwa={handleInstallPwa}
      />

      {/* Main Layout Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          currentView={currentView}
          onNavigate={(view) => {
            setCurrentView(view);
            if (view !== 'album-detail') setSelectedAlbum(null);
          }}
          albumsCount={albums.length}
          trashCount={trashAlbums.length + trashPhotos.length}
          isDriveConnected={currentUser?.isConnectedToDrive ?? false}
          studioProfile={studioProfile}
          user={currentUser}
          onLogout={handleLogout}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Center Content View */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {currentView === 'dashboard' && (
              <DashboardHome
                user={currentUser}
                studioProfile={studioProfile}
                albums={albums}
                photos={photos}
                trashCount={trashAlbums.length + trashPhotos.length}
                driveQuota={driveQuota}
                onOpenCreateAlbum={() => {
                  if (!currentUser || !currentUser.isConnectedToDrive) {
                    setIsAuthModalOpen(true);
                  } else {
                    setIsCreateAlbumOpen(true);
                  }
                }}
                onSelectAlbum={(alb) => {
                  setSelectedAlbum(alb);
                  setCurrentView('album-detail');
                }}
                onOpenQRCode={(alb) => setActiveQRAlbum(alb)}
                onOpenSettings={(alb) => setActiveSettingsAlbum(alb)}
                onNavigate={(v) => setCurrentView(v)}
                onConnectDrive={handleConnectDrive}
              />
            )}

            {currentView === 'albums' && (
              <AlbumList
                albums={albums}
                studioProfile={studioProfile}
                isDriveConnected={currentUser?.isConnectedToDrive ?? false}
                onConnectDrive={handleConnectDrive}
                onOpenCreateAlbum={() => {
                  if (!currentUser || !currentUser.isConnectedToDrive) {
                    setIsAuthModalOpen(true);
                  } else {
                    setIsCreateAlbumOpen(true);
                  }
                }}
                onOpenUploadFolder={() => {
                  if (!currentUser || !currentUser.isConnectedToDrive) {
                    setIsAuthModalOpen(true);
                  } else {
                    setUploadFolderTargetAlbumId(undefined);
                    setIsUploadFolderOpen(true);
                  }
                }}
                onOpenUploadPhotos={() => {
                  if (!currentUser || !currentUser.isConnectedToDrive) {
                    setIsAuthModalOpen(true);
                  } else {
                    setUploadFolderTargetAlbumId(undefined);
                    setIsUploadFolderOpen(true);
                  }
                }}
                onSelectAlbum={(alb) => {
                  setSelectedAlbum(alb);
                  setCurrentView('album-detail');
                }}
                onOpenQRCode={(alb) => setActiveQRAlbum(alb)}
                onOpenSettings={(alb) => setActiveSettingsAlbum(alb)}
                onMoveToTrash={(albumId) => {
                  if (currentUser) {
                    moveAlbumToTrash(currentUser.id, albumId);
                    refreshTenantData();
                  }
                }}
              />
            )}

            {currentView === 'album-detail' && selectedAlbum && (
              <AlbumDetail
                album={selectedAlbum}
                photos={photos.filter((p) => p.albumId === selectedAlbum.id)}
                studioProfile={studioProfile}
                user={currentUser}
                onBack={() => {
                  setSelectedAlbum(null);
                  setCurrentView('albums');
                }}
                onOpenQRCode={(alb) => setActiveQRAlbum(alb)}
                onOpenSettings={(alb) => setActiveSettingsAlbum(alb)}
                onOpenUploadFolder={(alb) => {
                  if (!currentUser || !currentUser.isConnectedToDrive) {
                    setIsAuthModalOpen(true);
                  } else {
                    setUploadFolderTargetAlbumId(alb.id);
                    setIsUploadFolderOpen(true);
                  }
                }}
                onAddPhotos={(newPhotos) => {
                  if (currentUser) {
                    addPhotosToAlbum(currentUser.id, selectedAlbum.id, newPhotos);
                    refreshTenantData();
                  }
                }}
                onDeletePhoto={(photoId) => {
                  if (currentUser) {
                    movePhotoToTrash(currentUser.id, photoId);
                    refreshTenantData();
                  }
                }}
                onMoveAlbumToTrash={(albumId) => {
                  if (currentUser) {
                    moveAlbumToTrash(currentUser.id, albumId);
                    refreshTenantData();
                  }
                }}
                onUpdateAlbum={handleUpdateAlbum}
                onRefreshTenantData={refreshTenantData}
              />
            )}

            {currentView === 'drive-status' && (
              <DriveStatusView
                user={currentUser}
                studioProfile={studioProfile}
                driveQuota={driveQuota}
                onConnectDrive={handleConnectDrive}
                onDisconnectDrive={() => {
                  if (currentUser) {
                    const disconnected = { ...currentUser, isConnectedToDrive: false };
                    saveActiveUserSession(disconnected);
                    setCurrentUser(disconnected);
                  }
                }}
                onRefreshQuota={async () => {
                  const token = currentUser ? getStoredUserToken(currentUser.id) || currentUser.accessToken : null;
                  if (token) {
                    const q = await getDriveStorageQuota(token);
                    setDriveQuota(q);
                  }
                }}
              />
            )}

            {currentView === 'branding' && (
              <BrandingSettings
                studioProfile={studioProfile}
                currentUser={currentUser}
                onSaveProfile={handleSaveProfile}
              />
            )}

            {currentView === 'settings' && (
              <BrandingSettings
                studioProfile={studioProfile}
                currentUser={currentUser}
                onSaveProfile={handleSaveProfile}
              />
            )}

            {currentView === 'trash' && (
              <TrashBinView
                trashAlbums={trashAlbums}
                trashPhotos={trashPhotos}
                studioProfile={studioProfile}
                onRestoreAlbum={async (albumId) => {
                  if (currentUser) {
                    await restoreAlbumFromTrash(currentUser.id, albumId);
                    refreshTenantData();
                  }
                }}
                onPermanentlyDeleteAlbum={async (albumId) => {
                  if (currentUser) {
                    const token = currentUser.accessToken || getStoredUserToken(currentUser.id) || undefined;
                    await permanentlyDeleteAlbum(currentUser.id, albumId, token);
                    refreshTenantData();
                  }
                }}
                onRestorePhoto={async (photoId) => {
                  if (currentUser) {
                    await restorePhotoFromTrash(currentUser.id, photoId);
                    refreshTenantData();
                  }
                }}
                onPermanentlyDeletePhoto={async (photoId) => {
                  if (currentUser) {
                    const token = currentUser.accessToken || getStoredUserToken(currentUser.id) || undefined;
                    await permanentlyDeletePhoto(currentUser.id, photoId, token);
                    refreshTenantData();
                  }
                }}
                onEmptyTrash={async () => {
                  if (currentUser) {
                    const token = currentUser.accessToken || getStoredUserToken(currentUser.id) || undefined;
                    await emptyTrash(currentUser.id, token);
                    refreshTenantData();
                  }
                }}
              />
            )}

            {currentView === 'admin-saas' && (
              <AdminSaaSDashboard
                currentUser={currentUser}
                onSwitchStudio={handleSwitchStudio}
              />
            )}

            {currentView === 'help' && (
              <HelpAndGuide studioProfile={studioProfile} />
            )}
          </div>
        </main>
      </div>

      {/* Modals */}
      <CreateAlbumModal
        isOpen={isCreateAlbumOpen}
        onClose={() => setIsCreateAlbumOpen(false)}
        user={currentUser}
        studioProfile={studioProfile}
        onCreateAlbum={handleCreateAlbum}
        onSuccess={(newAlb) => {
          setIsCreateAlbumOpen(false);
          setSelectedAlbum(newAlb);
          setCurrentView('album-detail');
          setActiveQRAlbum(newAlb);
        }}
      />

      <QRCodeModal
        isOpen={activeQRAlbum !== null}
        onClose={() => setActiveQRAlbum(null)}
        album={activeQRAlbum}
        studioProfile={studioProfile}
      />

      <UploadFolderModal
        isOpen={isUploadFolderOpen}
        onClose={() => {
          setIsUploadFolderOpen(false);
          setUploadFolderTargetAlbumId(undefined);
        }}
        user={currentUser}
        studioProfile={studioProfile}
        albums={albums}
        photos={photos}
        preselectedAlbumId={uploadFolderTargetAlbumId}
        onConnectDrive={handleConnectDrive}
        onCreateAlbum={async (albumData) => {
          if (!currentUser) throw new Error('Sesi pengguna tidak valid');
          const newAlb = createAlbum(currentUser.id, albumData);
          refreshTenantData();
          return newAlb;
        }}
        onAddPhotosToAlbum={(albumId, newPhotos) => {
          if (currentUser) {
            addPhotosToAlbum(currentUser.id, albumId, newPhotos);
            refreshTenantData();
          }
        }}
        onNavigateToAlbum={(alb) => {
          setSelectedAlbum(alb);
          setCurrentView('album-detail');
        }}
      />

      <AlbumSettingsModal
        isOpen={activeSettingsAlbum !== null}
        onClose={() => setActiveSettingsAlbum(null)}
        album={activeSettingsAlbum}
        studioProfile={studioProfile}
        onUpdateAlbum={handleUpdateAlbum}
        onMoveToTrash={(albumId) => {
          if (currentUser) {
            moveAlbumToTrash(currentUser.id, albumId);
            refreshTenantData();
            if (selectedAlbum && selectedAlbum.id === albumId) {
              setSelectedAlbum(null);
              setCurrentView('albums');
            }
          }
        }}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthModalOpen(false);
        }}
      />
    </div>
  );
}
