import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  GoogleAuthProvider,
} from 'firebase/auth';
import { auth, googleAuthProvider } from './firebase';

let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Store token in memory and session (for refresh recovery during current active session)
const TOKEN_SESSION_KEY = 'gfq_active_drive_token';

export function getCachedAccessToken(): string | null {
  if (cachedAccessToken) return cachedAccessToken;
  if (typeof window !== 'undefined') {
    const sessionToken = sessionStorage.getItem(TOKEN_SESSION_KEY);
    if (sessionToken) {
      cachedAccessToken = sessionToken;
      return cachedAccessToken;
    }
  }
  return null;
}

export function setCachedAccessToken(token: string | null): void {
  cachedAccessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      sessionStorage.setItem(TOKEN_SESSION_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_SESSION_KEY);
    }
  }
}

export async function signInWithGoogle(): Promise<{ user: User; accessToken: string }> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleAuthProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || '';

    if (!accessToken) {
      console.warn('[AUTH] Signed in, but access token not found in credential. Re-requesting scopes may be required.');
    }

    setCachedAccessToken(accessToken);
    console.log('[AUTH] Sign in successful for UID:', result.user.uid, 'Email:', result.user.email);
    return { user: result.user, accessToken };
  } catch (error: any) {
    console.error('[AUTH] Sign in failed:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
}

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

export function initAuthListener(
  onUserChanged: (user: User | null, token: string | null) => void
): () => void {
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
