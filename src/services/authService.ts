import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  User,
  GoogleAuthProvider,
} from 'firebase/auth';
import { auth, googleAuthProvider } from './firebase';

let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Token storage keys
const TOKEN_SESSION_KEY = 'gfq_active_drive_token';
const TOKEN_LOCAL_KEY = 'gfq_persistent_drive_token';

// Maximum token lifetime before re-consent (Google OAuth tokens expire in 1 hour)
const TOKEN_EXPIRY_MS = 3600 * 1000;

interface StoredTokenData {
  token: string;
  expiresAt: number;
}

/**
 * Ensures Firebase auth uses local browser persistence (IndexedDB).
 * Persists session across browser restarts and PWA standalone app launches.
 */
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('[AUTH] Could not set browserLocalPersistence:', err);
  });
}

/**
 * Retrieves the currently active Google Drive access token.
 * Checks: 1) Memory cache, 2) SessionStorage, 3) Persistent LocalStorage with expiry check.
 */
export function getCachedAccessToken(): string | null {
  if (cachedAccessToken) return cachedAccessToken;

  if (typeof window !== 'undefined') {
    // 1. Check Session Storage (Fastest within current browser session)
    const sessionToken = sessionStorage.getItem(TOKEN_SESSION_KEY);
    if (sessionToken) {
      cachedAccessToken = sessionToken;
      return cachedAccessToken;
    }

    // 2. Check Persistent Local Storage (Recovers session after PWA task close)
    try {
      const localDataRaw = localStorage.getItem(TOKEN_LOCAL_KEY);
      if (localDataRaw) {
        const parsed: StoredTokenData = JSON.parse(localDataRaw);
        if (parsed?.token && parsed.expiresAt && Date.now() < parsed.expiresAt) {
          cachedAccessToken = parsed.token;
          sessionStorage.setItem(TOKEN_SESSION_KEY, parsed.token);
          return cachedAccessToken;
        } else {
          // Token expired, clean up
          localStorage.removeItem(TOKEN_LOCAL_KEY);
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  return null;
}

/**
 * Stores the Google Drive access token securely in memory, session, and persistent storage.
 */
export function setCachedAccessToken(token: string | null): void {
  cachedAccessToken = token;

  if (typeof window !== 'undefined') {
    if (token) {
      sessionStorage.setItem(TOKEN_SESSION_KEY, token);

      const tokenData: StoredTokenData = {
        token,
        expiresAt: Date.now() + TOKEN_EXPIRY_MS,
      };
      try {
        localStorage.setItem(TOKEN_LOCAL_KEY, JSON.stringify(tokenData));
      } catch (err) {
        console.warn('[AUTH] Could not persist token to localStorage:', err);
      }
    } else {
      sessionStorage.removeItem(TOKEN_SESSION_KEY);
      try {
        localStorage.removeItem(TOKEN_LOCAL_KEY);
      } catch (err) {
        // Ignore removal error
      }
    }
  }
}

/**
 * Primary Google Sign-In via Popup (PWA & Web standard).
 * Falls back to redirect if popup is blocked by the mobile browser.
 */
export async function signInWithGoogle(): Promise<{ user: User; accessToken: string }> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleAuthProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || '';

    if (!accessToken) {
      console.warn('[AUTH] Signed in, but access token not found in credential.');
    }

    setCachedAccessToken(accessToken);
    console.log('[AUTH] Sign in successful for UID:', result.user.uid, 'Email:', result.user.email);
    return { user: result.user, accessToken };
  } catch (error: any) {
    const errorCode = error?.code || '';
    console.error('[AUTH] Sign in failed with code:', errorCode, error);

    // If popup was blocked by browser, attempt graceful fallback to signInWithRedirect
    if (errorCode === 'auth/popup-blocked') {
      console.warn('[AUTH] Popup blocked, falling back to signInWithRedirect...');
      await signInWithRedirect(auth, googleAuthProvider);
      return new Promise(() => {}); // Execution will transfer via browser redirect
    }

    throw error;
  } finally {
    isSigningIn = false;
  }
}

/**
 * Sign out user from Firebase and clear all token caches.
 */
export async function signOut(): Promise<void> {
  try {
    setCachedAccessToken(null);
    await firebaseSignOut(auth);
    console.log('[AUTH] User signed out');
  } catch (error) {
    console.error('[AUTH] Sign out error:', error);
    throw error;
  }
}

/**
 * Initializes the Firebase Auth listener and processes any pending redirect results.
 */
export function initAuthListener(
  onUserChanged: (user: User | null, token: string | null) => void
): () => void {
  // Check for any pending redirect result on app mount (e.g. if redirect was used)
  if (typeof window !== 'undefined') {
    getRedirectResult(auth)
      .then((redirectResult) => {
        if (redirectResult && redirectResult.user) {
          const credential = GoogleAuthProvider.credentialFromResult(redirectResult);
          const redirectToken = credential?.accessToken;
          if (redirectToken) {
            console.log('[AUTH] Recovered access token from redirect result.');
            setCachedAccessToken(redirectToken);
            onUserChanged(redirectResult.user, redirectToken);
          }
        }
      })
      .catch((err) => {
        // Non-fatal redirect recovery notice
        console.warn('[AUTH] Redirect check notice:', err?.message);
      });
  }

  return onAuthStateChanged(auth, (user) => {
    if (user) {
      const token = getCachedAccessToken();
      onUserChanged(user, token);
    } else {
      if (!isSigningIn) {
        setCachedAccessToken(null);
        onUserChanged(null, null);
      }
    }
  });
}
