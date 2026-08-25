import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  signInWithGoogle,
  signOut as authSignOut,
  initAuthListener,
  getCachedAccessToken,
  setCachedAccessToken,
} from '../services/authService';

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isDriveConnected: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  connectDrive: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(getCachedAccessToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initAuthListener((currentUser, token) => {
      setUser(currentUser);
      const activeToken = token || getCachedAccessToken();
      setAccessToken(activeToken);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await signInWithGoogle();
      setUser(result.user);
      setAccessToken(result.accessToken);
    } catch (err: any) {
      console.error('[AUTH] Sign in hook error:', err);
      setError(err?.message || 'Gagal masuk dengan Google.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await authSignOut();
      setUser(null);
      setAccessToken(null);
    } catch (err: any) {
      console.error('[AUTH] Sign out hook error:', err);
      setError(err?.message || 'Gagal keluar.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleConnectDrive = useCallback(async () => {
    return handleSignIn();
  }, [handleSignIn]);

  return {
    user,
    accessToken,
    isLoading,
    isDriveConnected: Boolean(user && accessToken),
    error,
    signIn: handleSignIn,
    signOut: handleSignOut,
    connectDrive: handleConnectDrive,
  };
}
