/**
 * Centralized Application Configuration & Single Source of Truth
 * Ensures GitHub Pages, Custom Domains, and Cloud Run integrations work without URL mismatches.
 */

const STORAGE_KEY_PUBLIC_URL = 'gfq_config_frontend_public_url';
const STORAGE_KEY_API_URL = 'gfq_config_api_base_url';

export const DEFAULT_ROOT_FOLDER_NAME = 'GaleriFotoQR Cloud Studio';
export const DEFAULT_CUSTOMER_ALBUMS_FOLDER = 'Album Pelanggan';

/**
 * Default production frontend repository host (GitHub Pages).
 */
export const DEFAULT_PRODUCTION_FRONTEND_URL = 'https://chyndra07.github.io/Cloud-Studio';

/**
 * Checks if a given URL or hostname belongs to Google AI Studio editor/preview/cloud-dev environment.
 */
export function isAiStudioHost(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('aistudio.google.com') ||
    lower.includes('ais-preview') ||
    lower.includes('ais-dev') ||
    lower.includes('ais-pre') ||
    lower.includes('googleusercontent.com') ||
    lower.includes('run.app') ||
    lower.includes('localhost') ||
    lower.includes('127.0.0.1')
  );
}

/**
 * Returns the currently active Frontend Public URL (Single Source of Truth).
 * 
 * Priority:
 * 1. User configured FRONTEND_PUBLIC_URL from localStorage (e.g. GitHub Pages URL from Settings)
 * 2. VITE_FRONTEND_PUBLIC_URL environment variable if provided at build time
 * 3. window.location.origin + pathname IF it's a real public production host (like *.github.io or custom domain)
 * 4. Guaranteed fallback: DEFAULT_PRODUCTION_FRONTEND_URL (https://chyndra07.github.io/Cloud-Studio)
 */
export function getFrontendPublicUrl(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_PRODUCTION_FRONTEND_URL;
  }

  // 1. Check user configured FRONTEND_PUBLIC_URL in localStorage
  const savedUrl = localStorage.getItem(STORAGE_KEY_PUBLIC_URL);
  if (savedUrl && savedUrl.trim() !== '') {
    const cleanSaved = savedUrl.trim().replace(/\/+$/, '');
    if (!isAiStudioHost(cleanSaved)) {
      return cleanSaved;
    }
  }

  // 2. Check build-time environment variable
  const envUrl = (import.meta as any).env?.VITE_FRONTEND_PUBLIC_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    const cleanEnv = envUrl.trim().replace(/\/+$/, '');
    if (!isAiStudioHost(cleanEnv)) {
      return cleanEnv;
    }
  }

  // 3. Check current window location IF it is already running on a real production domain (e.g. GitHub Pages or custom domain)
  const origin = window.location.origin || '';
  const pathname = (window.location.pathname || '').replace(/\/+$/, '');
  const currentFullUrl = `${origin}${pathname}`.replace(/\/+$/, '');

  if (origin && !isAiStudioHost(origin)) {
    return currentFullUrl;
  }

  // 4. Default production fallback (Never use AI Studio URL)
  return DEFAULT_PRODUCTION_FRONTEND_URL;
}

/**
 * Checks whether the production public URL has been explicitly configured or validated.
 */
export function isProductionUrlConfigured(): boolean {
  if (typeof window === 'undefined') return true;
  const saved = localStorage.getItem(STORAGE_KEY_PUBLIC_URL);
  if (saved && saved.trim() !== '' && !isAiStudioHost(saved)) {
    return true;
  }
  const envUrl = (import.meta as any).env?.VITE_FRONTEND_PUBLIC_URL;
  if (envUrl && !isAiStudioHost(envUrl)) {
    return true;
  }
  return !isAiStudioHost(window.location.origin);
}

export function setFrontendPublicUrl(url: string): void {
  if (typeof window !== 'undefined') {
    if (!url || url.trim() === '') {
      localStorage.removeItem(STORAGE_KEY_PUBLIC_URL);
    } else {
      localStorage.setItem(STORAGE_KEY_PUBLIC_URL, url.trim().replace(/\/+$/, ''));
    }
  }
}

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const saved = localStorage.getItem(STORAGE_KEY_API_URL);
  if (saved && saved.trim() !== '') {
    return saved.trim().replace(/\/+$/, '');
  }
  return '';
}

export function setApiBaseUrl(url: string): void {
  if (typeof window !== 'undefined') {
    if (!url || url.trim() === '') {
      localStorage.removeItem(STORAGE_KEY_API_URL);
    } else {
      localStorage.setItem(STORAGE_KEY_API_URL, url.trim().replace(/\/+$/, ''));
    }
  }
}

/**
 * SINGLE SOURCE OF TRUTH for Public Gallery URLs.
 * Used identically by:
 * 1. "Salin Tautan Galeri" (Copy Link button)
 * 2. QR Code Generator & QR Printable Cards
 * 3. Client sharing & WhatsApp share
 * 4. "Buka Halaman Galeri" buttons
 * 
 * Guaranteed format: ${FRONTEND_PUBLIC_URL}/#/gallery/${galleryId}
 */
export function getPublicGalleryUrl(galleryId: string): string {
  const baseUrl = getFrontendPublicUrl();
  const cleanId = (galleryId || '').trim().toUpperCase();
  
  const finalUrl = `${baseUrl}/#/gallery/${cleanId}`;

  // Strict Anti-AI-Studio validation check
  if (finalUrl.includes('aistudio.google.com') || finalUrl.includes('googleusercontent.com')) {
    console.error('[CRITICAL_URL_GUARD] URL contained AI Studio domain, falling back to default production URL:', finalUrl);
    return `${DEFAULT_PRODUCTION_FRONTEND_URL}/#/gallery/${cleanId}`;
  }

  return finalUrl;
}

/**
 * Generates unique permanent Gallery ID format: GFQ-XXXXXX (6 alphanumeric uppercase characters)
 */
export function generateGalleryId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing O, 0, I, 1
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `GFQ-${code}`;
}

/**
 * Generates random 4-digit PIN
 */
export function generateDefaultPin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}


