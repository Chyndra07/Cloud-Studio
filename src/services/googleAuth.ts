import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  GoogleAuthProvider,
  browserPopupRedirectResolver,
} from 'firebase/auth';
import { GOOGLE_CONFIG, FIREBASE_APP_CONFIG } from '../config/googleConfig';
import { UserAccount } from '../types';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token?: string;
              expires_in?: number;
              error?: string;
              error_description?: string;
            }) => void;
            error_callback?: (err: any) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

// ----------------- FIREBASE INITIALIZATION -----------------
const firebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(FIREBASE_APP_CONFIG);
export const auth = getAuth(firebaseApp);

export function createGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  // Request minimal required Workspace scopes for studio photo management
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  provider.addScope('https://www.googleapis.com/auth/userinfo.email');
  provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
  provider.setCustomParameters({
    prompt: 'select_account',
    access_type: 'offline',
  });
  return provider;
}

const SESSION_KEY = 'galerifotoqr_active_user';
const TOKEN_KEY = 'galerifotoqr_drive_token';

// ----------------- ENVIRONMENT DETECTION -----------------
export interface AppEnvironment {
  isIframe: boolean;
  isPWA: boolean;
  isMobile: boolean;
  isAIStudioPreview: boolean;
  origin: string;
  pathname: string;
}

export function detectEnvironment(): AppEnvironment {
  const isIframe = typeof window !== 'undefined' && window.self !== window.top;
  const isPWA =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true);
  const isMobile =
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isAIStudioPreview = hostname.includes('.run.app') || hostname.includes('aistudio');

  return {
    isIframe,
    isPWA,
    isMobile,
    isAIStudioPreview,
    origin: typeof window !== 'undefined' ? window.location.origin : '',
    pathname: typeof window !== 'undefined' ? window.location.pathname : '',
  };
}

// ----------------- DEBUG LOGGING (SECURITY SAFE) -----------------
export function logAuthDebug(phase: string, details: Record<string, any>) {
  if (typeof window !== 'undefined') {
    const isDev = process.env.NODE_ENV !== 'production' || window.location.hostname.includes('localhost') || window.location.hostname.includes('.run.app');
    if (isDev) {
      console.groupCollapsed(`[GaleriFotoQR Google Auth] ${phase} - ${new Date().toLocaleTimeString()}`);
      for (const [key, val] of Object.entries(details)) {
        if (
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('password')
        ) {
          console.log(`${key}:`, val ? `[PROTECTED STRING length=${String(val).length}]` : '[EMPTY]');
        } else {
          console.log(`${key}:`, val);
        }
      }
      console.groupEnd();
    }
  }
}

// ----------------- USER PROFILE LOOKUP -----------------
export async function fetchGoogleUserInfo(accessToken: string): Promise<{
  id: string;
  email: string;
  name: string;
  picture?: string;
}> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Gagal mengambil profil akun Google. Silakan login ulang.');
  }

  const data = await response.json();
  return {
    id: data.sub,
    email: data.email,
    name: data.name || data.email.split('@')[0],
    picture: data.picture,
  };
}

// ----------------- ERROR TRANSLATOR & PARSER -----------------
export function parseAuthErrorMessage(error: any): string {
  if (!error) return 'Terjadi kendala autentikasi Google.';
  const code = error.code || '';
  const message = error.message || '';
  const env = detectEnvironment();

  logAuthDebug('Authentication Error Encountered', {
    errorCode: code,
    errorMessage: message,
    environment: env,
    currentOrigin: env.origin,
  });

  if (code === 'auth/popup-blocked') {
    return 'Jendela login popup diblokir oleh browser. Sistem otomatis mengalihkan ke mode login halaman penuh (redirect).';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Jendela login Google ditutup sebelum proses otorisasi selesai. Silakan tekan tombol Masuk kembali.';
  }
  if (code === 'auth/cancelled-popup-request') {
    return 'Proses login diperbarui. Silakan coba kembali.';
  }
  if (code === 'auth/unauthorized-domain') {
    return env.isAIStudioPreview
      ? 'Domain pratinjau belum terdaftar di OAuth Google Cloud. Login Google perlu diuji melalui URL aplikasi yang telah di-deploy.'
      : 'Domain web ini belum diizinkan pada konfigurasi OAuth Google Cloud / Firebase Console.';
  }
  if (code === 'auth/network-request-failed' || message.includes('network')) {
    return 'Koneksi jaringan terputus saat menghubungi server Google. Periksa koneksi internet Anda.';
  }
  if (code === 'auth/user-disabled') {
    return 'Akun Google ini telah dinonaktifkan.';
  }
  if (message.includes('access_denied') || code === 'access_denied') {
    return 'Izin akses Google Drive dibatalkan atau ditolak oleh pengguna.';
  }
  if (message.includes('redirect_uri_mismatch')) {
    return 'Redirect URI tidak sesuai dengan konfigurasi OAuth Google Cloud.';
  }
  if (message.includes('cookie') || message.includes('storage')) {
    return 'Browser membatasi cookie pihak ketiga. Izinkan cookie atau buka aplikasi di jendela browser mandiri.';
  }

  return message.length > 0 ? message : 'Gagal memproses otorisasi Google Drive.';
}

// ----------------- REDIRECT RESULT CHECKER (ON MOUNT) -----------------
export async function checkAndHandleRedirectResult(): Promise<{
  accessToken: string;
  userInfo: { id: string; email: string; name: string; picture?: string };
} | null> {
  const env = detectEnvironment();
  logAuthDebug('Checking Redirect Result on App Mount', { environment: env });

  try {
    const result = await getRedirectResult(auth, browserPopupRedirectResolver);
    if (!result || !result.user) {
      return null;
    }

    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;

    if (!accessToken) {
      logAuthDebug('Redirect result found user but no access token in credential', {
        userEmail: result.user.email,
      });
      return null;
    }

    let userInfo: { id: string; email: string; name: string; picture?: string };
    try {
      userInfo = await fetchGoogleUserInfo(accessToken);
    } catch {
      userInfo = {
        id: result.user.uid,
        email: result.user.email || '',
        name: result.user.displayName || result.user.email?.split('@')[0] || 'Studio Owner',
        picture: result.user.photoURL || undefined,
      };
    }

    // Save token securely per user
    const tokenData = {
      token: accessToken,
      expiresAt: Date.now() + 3600 * 1000,
      userId: userInfo.id,
    };
    localStorage.setItem(`${TOKEN_KEY}_${userInfo.id}`, JSON.stringify(tokenData));

    // Register token to backend proxy
    fetch('/api/studio/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerId: userInfo.id,
        token: accessToken,
        expiresAt: tokenData.expiresAt,
      }),
    }).catch(() => {});

    logAuthDebug('Redirect Authentication Succeeded', {
      userId: userInfo.id,
      userEmail: userInfo.email,
      tokenExpiresAt: tokenData.expiresAt,
    });

    return {
      accessToken,
      userInfo,
    };
  } catch (err: any) {
    const friendlyMsg = parseAuthErrorMessage(err);
    logAuthDebug('Redirect Result Failed', { error: err, friendlyMsg });
    return null;
  }
}

// ----------------- PRIMARY AUTHENTICATION WITH REDIRECT FALLBACK -----------------
export async function requestGoogleDriveAuth(options: { forceRedirect?: boolean } = {}): Promise<{
  accessToken: string;
  userInfo: { id: string; email: string; name: string; picture?: string };
}> {
  const env = detectEnvironment();
  const provider = createGoogleProvider();

  logAuthDebug('Initiating Google Drive Authentication', {
    options,
    environment: env,
    clientId: GOOGLE_CONFIG.clientId,
    scopes: GOOGLE_CONFIG.scopes,
  });

  // If forceRedirect or embedded in iframe that doesn't support popups, use signInWithRedirect
  if (options.forceRedirect) {
    logAuthDebug('Executing signInWithRedirect directly (Forced)', { origin: env.origin });
    await signInWithRedirect(auth, provider);
    // signInWithRedirect navigates the browser away
    return new Promise(() => {});
  }

  // Strategy 1: Attempt Firebase signInWithPopup
  try {
    const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;

    if (!accessToken) {
      throw new Error('Token akses Google Drive tidak diterima dari penyedia autentikasi.');
    }

    let userInfo: { id: string; email: string; name: string; picture?: string };
    try {
      userInfo = await fetchGoogleUserInfo(accessToken);
    } catch {
      userInfo = {
        id: result.user.uid,
        email: result.user.email || '',
        name: result.user.displayName || result.user.email?.split('@')[0] || 'Studio Owner',
        picture: result.user.photoURL || undefined,
      };
    }

    const tokenData = {
      token: accessToken,
      expiresAt: Date.now() + 3600 * 1000,
      userId: userInfo.id,
    };
    localStorage.setItem(`${TOKEN_KEY}_${userInfo.id}`, JSON.stringify(tokenData));

    // Register token to backend server
    fetch('/api/studio/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerId: userInfo.id,
        token: accessToken,
        expiresAt: tokenData.expiresAt,
      }),
    }).catch(() => {});

    logAuthDebug('Popup Authentication Successful', {
      userId: userInfo.id,
      userEmail: userInfo.email,
    });

    return {
      accessToken,
      userInfo,
    };
  } catch (popupError: any) {
    const errorCode = popupError?.code || '';
    logAuthDebug('Popup Sign-In Threw Error', {
      errorCode,
      errorMessage: popupError?.message,
    });

    // Check if error is popup-blocking or iframe restriction: fallback to Google Identity Services or signInWithRedirect
    if (
      errorCode === 'auth/popup-blocked' ||
      errorCode === 'auth/cancelled-popup-request' ||
      errorCode === 'auth/internal-error' ||
      env.isIframe
    ) {
      // Strategy 2: If Google Identity Services is available in window, try GIS Token Client
      if (window.google?.accounts?.oauth2) {
        logAuthDebug('Attempting fallback to Google Identity Services Token Client', {});
        try {
          const gisResult = await new Promise<{
            accessToken: string;
            userInfo: { id: string; email: string; name: string; picture?: string };
          }>((resolve, reject) => {
            const tokenClient = window.google!.accounts.oauth2.initTokenClient({
              client_id: GOOGLE_CONFIG.clientId,
              scope: GOOGLE_CONFIG.scopes,
              callback: async (response) => {
                if (response.error) {
                  reject(new Error(response.error_description || response.error));
                  return;
                }
                if (!response.access_token) {
                  reject(new Error('Token akses tidak diterima dari Google.'));
                  return;
                }
                try {
                  const userInfo = await fetchGoogleUserInfo(response.access_token);
                  const tokenData = {
                    token: response.access_token,
                    expiresAt: Date.now() + (response.expires_in || 3600) * 1000,
                    userId: userInfo.id,
                  };
                  localStorage.setItem(`${TOKEN_KEY}_${userInfo.id}`, JSON.stringify(tokenData));

                  fetch('/api/studio/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      ownerId: userInfo.id,
                      token: response.access_token,
                      expiresAt: tokenData.expiresAt,
                    }),
                  }).catch(() => {});

                  resolve({
                    accessToken: response.access_token,
                    userInfo,
                  });
                } catch (err: any) {
                  reject(err);
                }
              },
              error_callback: (err) => {
                reject(err);
              },
            });
            tokenClient.requestAccessToken({ prompt: 'consent' });
          });

          return gisResult;
        } catch (gisErr: any) {
          logAuthDebug('GIS Token Client Fallback Failed, initiating signInWithRedirect', {
            gisErr: gisErr?.message,
          });
        }
      }

      // Strategy 3: Automatic fallback to signInWithRedirect
      logAuthDebug('Fallback to signInWithRedirect triggered', { origin: env.origin });
      try {
        await signInWithRedirect(auth, provider);
        return new Promise(() => {});
      } catch (redirectErr: any) {
        throw new Error(parseAuthErrorMessage(redirectErr));
      }
    }

    throw new Error(parseAuthErrorMessage(popupError));
  }
}

// ----------------- SESSION & TOKEN MANAGEMENT (MULTI-USER ISOLATED) -----------------
export function getStoredUserToken(userId: string): string | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(`${TOKEN_KEY}_${userId}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.expiresAt && Date.now() > data.expiresAt) {
      return null; // Expired token
    }
    return data.token || null;
  } catch {
    return null;
  }
}

export function saveActiveUserSession(user: UserAccount) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  logAuthDebug('Active User Session Saved', {
    userId: user.id,
    userEmail: user.email,
    role: user.role,
    isConnectedToDrive: user.isConnectedToDrive,
  });
}

export function getActiveUserSession(): UserAccount | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const user: UserAccount = JSON.parse(raw);
    // Check if token expiration exists and expired
    if (user.tokenExpiresAt && Date.now() > user.tokenExpiresAt) {
      // Token expired, require refresh
      user.isConnectedToDrive = false;
    }
    return user;
  } catch {
    return null;
  }
}

export async function clearUserSession() {
  const current = getActiveUserSession();
  if (current?.id) {
    localStorage.removeItem(`${TOKEN_KEY}_${current.id}`);
  }
  localStorage.removeItem(SESSION_KEY);

  try {
    await signOut(auth);
  } catch (err) {
    // Ignore sign out errors
  }

  logAuthDebug('User Session Cleared (Logged out)', {
    previousUserId: current?.id,
    previousEmail: current?.email,
  });
}

