import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { checkLicenseStatus } from './licenseService';
import { LicensePublicData, LicenseStatus } from './licenseTypes';
import { LicenseActivationPage } from './LicenseActivationPage';
import { LicenseExpiredPage } from './LicenseExpiredPage';
import { LicenseSuspendedPage } from './LicenseSuspendedPage';
import { LicenseDisabledPage } from './LicenseDisabledPage';
import { DeveloperLicenseModal } from './DeveloperLicenseModal';
import { ShieldCheck, Lock } from 'lucide-react';

interface LicenseGuardProps {
  user: User | null;
  isAuthLoading: boolean;
  onSignOut: () => void;
  children: (props: {
    license: LicensePublicData | null;
    refreshLicense: () => Promise<void>;
    openDeveloperPanel: () => void;
  }) => React.ReactNode;
}

export const LicenseGuard: React.FC<LicenseGuardProps> = ({
  user,
  isAuthLoading,
  onSignOut,
  children,
}) => {
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | 'checking'>('checking');
  const [licenseData, setLicenseData] = useState<LicensePublicData | null>(null);
  const [isDeveloperModalOpen, setIsDeveloperModalOpen] = useState<boolean>(false);

  const fetchStatus = useCallback(async (targetUser: User) => {
    setLicenseStatus('checking');
    try {
      const res = await checkLicenseStatus(targetUser);
      if (res.valid && res.license) {
        setLicenseData(res.license);
        setLicenseStatus(res.license.status || 'active');
      } else {
        setLicenseData(res.license || null);
        setLicenseStatus(res.status || 'not_found');
      }
    } catch (err) {
      console.error('[LICENSE_GUARD] Error verifying license:', err);
      setLicenseStatus('not_found');
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchStatus(user);
    } else {
      setLicenseStatus('checking');
      setLicenseData(null);
    }
  }, [user, fetchStatus]);

  const handleRefreshLicense = async () => {
    if (user) {
      await fetchStatus(user);
    }
  };

  const handleActivated = (newLicense: LicensePublicData) => {
    setLicenseData(newLicense);
    setLicenseStatus('active');
  };

  // 1. Auth is loading
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 space-y-4 text-white">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-300">Memeriksa autentikasi Google...</p>
      </div>
    );
  }

  // 2. User is not logged in - let App.tsx render the public login / welcome page
  if (!user) {
    return (
      <>
        {children({
          license: null,
          refreshLicense: async () => {},
          openDeveloperPanel: () => setIsDeveloperModalOpen(true),
        })}
        <DeveloperLicenseModal
          isOpen={isDeveloperModalOpen}
          onClose={() => setIsDeveloperModalOpen(false)}
        />
      </>
    );
  }

  // 3. User is logged in, checking license status on Cloud Run API
  if (licenseStatus === 'checking') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 space-y-4 text-white text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <div className="space-y-1">
          <p className="text-sm font-bold text-white">Memverifikasi Hak Akses Lisensi...</p>
          <p className="text-xs text-slate-400">Menghubungkan akun Google ({user.email}) ke License Validation API</p>
        </div>
      </div>
    );
  }

  // 4. Pending or Not Found -> Render Activation Page
  if (licenseStatus === 'not_found' || licenseStatus === 'pending') {
    return (
      <>
        <LicenseActivationPage
          user={user}
          onActivated={handleActivated}
          onSignOut={onSignOut}
          onRefreshCheck={handleRefreshLicense}
          onOpenDeveloperPanel={() => setIsDeveloperModalOpen(true)}
        />
        <DeveloperLicenseModal
          isOpen={isDeveloperModalOpen}
          onClose={() => {
            setIsDeveloperModalOpen(false);
            handleRefreshLicense();
          }}
        />
      </>
    );
  }

  // 5. Expired -> Render License Expired Page
  if (licenseStatus === 'expired') {
    return (
      <>
        <LicenseExpiredPage
          user={user}
          license={licenseData || undefined}
          onRefreshCheck={handleRefreshLicense}
          onSignOut={onSignOut}
          onOpenDeveloperPanel={() => setIsDeveloperModalOpen(true)}
        />
        <DeveloperLicenseModal
          isOpen={isDeveloperModalOpen}
          onClose={() => {
            setIsDeveloperModalOpen(false);
            handleRefreshLicense();
          }}
        />
      </>
    );
  }

  // 6. Suspended -> Render Suspended Page
  if (licenseStatus === 'suspended') {
    return (
      <>
        <LicenseSuspendedPage
          user={user}
          license={licenseData || undefined}
          onRefreshCheck={handleRefreshLicense}
          onSignOut={onSignOut}
          onOpenDeveloperPanel={() => setIsDeveloperModalOpen(true)}
        />
        <DeveloperLicenseModal
          isOpen={isDeveloperModalOpen}
          onClose={() => {
            setIsDeveloperModalOpen(false);
            handleRefreshLicense();
          }}
        />
      </>
    );
  }

  // 7. Disabled -> Render Disabled Page
  if (licenseStatus === 'disabled') {
    return (
      <>
        <LicenseDisabledPage
          user={user}
          license={licenseData || undefined}
          onRefreshCheck={handleRefreshLicense}
          onSignOut={onSignOut}
          onOpenDeveloperPanel={() => setIsDeveloperModalOpen(true)}
        />
        <DeveloperLicenseModal
          isOpen={isDeveloperModalOpen}
          onClose={() => {
            setIsDeveloperModalOpen(false);
            handleRefreshLicense();
          }}
        />
      </>
    );
  }

  // 8. License is ACTIVE -> Render Studio Application
  return (
    <>
      {children({
        license: licenseData,
        refreshLicense: handleRefreshLicense,
        openDeveloperPanel: () => setIsDeveloperModalOpen(true),
      })}
      <DeveloperLicenseModal
        isOpen={isDeveloperModalOpen}
        onClose={() => {
          setIsDeveloperModalOpen(false);
          handleRefreshLicense();
        }}
      />
    </>
  );
};
