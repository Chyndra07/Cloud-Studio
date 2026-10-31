/**
 * SevenCloud / GaleriFotoQR Cloud Studio — PWA Management Service
 *
 * Handles Service Worker registration, standalone display mode detection,
 * and PWA Add-To-Home-Screen (install prompt) events.
 */

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installListeners: Array<(canInstall: boolean) => void> = [];

/**
 * Checks if the app is currently running in standalone (installed PWA) mode.
 */
export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;

  const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
  const isIOSStandalone = (window.navigator as any).standalone === true;
  const isAndroidTWA = document.referrer.includes('android-app://');

  return Boolean(isStandaloneMedia || isIOSStandalone || isAndroidTWA);
}

/**
 * Checks if a deferred native install prompt is currently queued.
 */
export function isInstallPromptAvailable(): boolean {
  return Boolean(deferredPrompt && !isRunningStandalone());
}

/**
 * Register Service Worker for offline support and PWA installability.
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // Defer registration until window load to avoid competing with main bundle execution
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[PWA] Service Worker registered with scope:', registration.scope);

        // Check for updates periodically
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (
                installingWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                console.log('[PWA] New version of SevenCloud is available.');
              }
            });
          }
        });
      })
      .catch((error) => {
        console.warn('[PWA] Service Worker registration failed:', error);
      });
  });

  // Capture beforeinstallprompt for Android Chrome
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    console.log('[PWA] beforeinstallprompt event captured.');
    notifyInstallListeners(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    console.log('[PWA] SevenCloud was installed successfully.');
    notifyInstallListeners(false);
  });
}

/**
 * Subscribe to installability changes (e.g. to show or hide an install button).
 */
export function subscribeToInstallPrompt(callback: (canInstall: boolean) => void): () => void {
  installListeners.push(callback);
  callback(Boolean(deferredPrompt && !isRunningStandalone()));

  return () => {
    const idx = installListeners.indexOf(callback);
    if (idx !== -1) {
      installListeners.splice(idx, 1);
    }
  };
}

function notifyInstallListeners(canInstall: boolean): void {
  const isEligible = canInstall && !isRunningStandalone();
  for (const listener of installListeners) {
    try {
      listener(isEligible);
    } catch (err) {
      console.warn('[PWA] Error notifying install listener:', err);
    }
  }
}

/**
 * Triggers the native Android install prompt.
 */
export async function promptPWAInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) {
    console.log('[PWA] No deferred prompt available.');
    return 'unavailable';
  }

  try {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    notifyInstallListeners(false);
    return choice.outcome;
  } catch (err) {
    console.error('[PWA] Prompt installation error:', err);
    return 'unavailable';
  }
}
