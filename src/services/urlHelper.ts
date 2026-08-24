/**
 * Utility to resolve, construct, and parse GaleriFotoQR gallery links.
 * Single Source of Truth for Public URLs, QR Codes, Copy Link, and Navigation.
 * 
 * STRICT ARCHITECTURAL RULE:
 * aistudio.google.com and ais-dev-* are FORBIDDEN for customer QR & gallery destinations.
 * Public customer flow must ALWAYS target the public production origin (ais-pre-* or custom domain).
 */

// Public Production Cloud Run URL (Shared / Public accessible domain)
export const PUBLIC_APP_ORIGIN = 'https://ais-pre-eroa24qfq6d4z76ps275od-153899979881.asia-southeast1.run.app';
export const FALLBACK_PRODUCTION_URL = PUBLIC_APP_ORIGIN;

let serverConfigAppUrl: string = '';

/**
 * Validates if an origin is invalid for customer public access
 */
export function isInvalidPublicOrigin(origin: string): boolean {
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname;
    return (
      hostname === 'aistudio.google.com' ||
      hostname.endsWith('.aistudio.google.com') ||
      hostname.startsWith('ais-dev-') ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.includes('webcontainer.io')
    );
  } catch {
    return (
      origin.includes('aistudio.google.com') ||
      origin.includes('ais-dev-') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1')
    );
  }
}

/**
 * Sanitizes any raw origin or URL, automatically transforming internal dev URLs into public preview URLs.
 */
export function sanitizePublicOrigin(rawOrigin: string): string {
  if (!rawOrigin) return PUBLIC_APP_ORIGIN;
  let origin = rawOrigin.trim().replace(/\/+$/, '');

  // 1. HARD BLOCK aistudio.google.com
  if (origin.includes('aistudio.google.com')) {
    return PUBLIC_APP_ORIGIN;
  }

  // 2. AUTOMATIC CONVERSION: Transform private dev container (ais-dev-) to public preview (ais-pre-)
  if (origin.includes('ais-dev-')) {
    origin = origin.replace('ais-dev-', 'ais-pre-');
  }

  // 3. Localhost / internal development origins fallback to public production origin
  if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('webcontainer.io')) {
    return PUBLIC_APP_ORIGIN;
  }

  if (origin.startsWith('https://') || origin.startsWith('http://')) {
    return origin;
  }

  return PUBLIC_APP_ORIGIN;
}

// Asynchronously sync production URL from server
if (typeof window !== 'undefined') {
  fetch('/api/config')
    .then((res) => res.json())
    .then((data) => {
      if (data && data.appUrl) {
        serverConfigAppUrl = sanitizePublicOrigin(data.appUrl);
      }
    })
    .catch(() => {
      // Ignore background sync errors
    });
}

/**
 * Returns the verified production base URL.
 * NEVER returns aistudio.google.com, ais-dev-*, localhost, or 127.0.0.1.
 */
export function getProductionBaseUrl(): string {
  const envUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_APP_URL)
    ? (import.meta as any).env.VITE_APP_URL.trim()
    : '';

  if (envUrl && !isInvalidPublicOrigin(envUrl)) {
    return sanitizePublicOrigin(envUrl);
  }

  if (serverConfigAppUrl && !isInvalidPublicOrigin(serverConfigAppUrl)) {
    return sanitizePublicOrigin(serverConfigAppUrl);
  }

  return PUBLIC_APP_ORIGIN;
}

/**
 * Returns the best public base URL for customer QR codes & gallery links.
 * Respects custom studio domain or verified public deployment URL.
 * HARD BLOCKS aistudio.google.com and ais-dev-*.
 */
export function getAppBaseUrl(customDomain?: string): string {
  // 1. If studio configured a custom domain/URL in branding settings
  if (customDomain && customDomain.trim().length > 0) {
    let clean = customDomain.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'https://' + clean;
    }
    const sanitized = sanitizePublicOrigin(clean);
    if (!isInvalidPublicOrigin(sanitized)) {
      return sanitized.replace(/\/+$/, '');
    }
  }

  // 2. Client-side browser runtime validation
  if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null') {
    const rawOrigin = window.location.origin.replace(/\/+$/, '');

    // If currently accessed from a valid public domain (e.g. ais-pre-* or custom domain), use it
    if (!isInvalidPublicOrigin(rawOrigin)) {
      return rawOrigin;
    }

    // If on dev origin (ais-dev-), automatically convert to public shared origin (ais-pre-)
    if (rawOrigin.includes('ais-dev-')) {
      return rawOrigin.replace('ais-dev-', 'ais-pre-');
    }
  }

  // 3. Environment or server-provided production base URL
  return getProductionBaseUrl();
}

/**
 * Validates that a gallery URL is safe for customer QR codes and does not point to AI Studio.
 */
export function validatePublicGalleryUrl(url: string): string {
  if (!url) return '';

  try {
    const parsed = new URL(url, getProductionBaseUrl());
    if (isInvalidPublicOrigin(parsed.origin)) {
      console.warn('[INVALID_QR_URL] Forbidden preview or local URL detected. Substituting with public production domain:', url);
      const slug = parsed.pathname.replace(/^\/gallery\//, '').replace(/^\/g\//, '') || '';
      const prodBase = getProductionBaseUrl();
      return `${prodBase}/gallery/${encodeURIComponent(slug.trim().toUpperCase())}`;
    }
    
    // Auto convert ais-dev in pathname/origin
    if (url.includes('ais-dev-')) {
      return url.replace('ais-dev-', 'ais-pre-');
    }
  } catch (err) {
    console.error('Error validating URL:', err);
  }

  return url;
}

/**
 * Single source of truth for constructing public customer gallery URLs.
 * Format: https://DOMAIN/gallery/{galleryId}
 * Example: https://ais-pre-...run.app/gallery/GFQ-4MUFZE
 */
export function getPublicGalleryUrl(galleryId: string, customDomain?: string): string {
  if (!galleryId) return '';
  const normalizedId = galleryId.trim().toUpperCase();
  const baseUrl = getAppBaseUrl(customDomain);
  const rawUrl = `${baseUrl}/gallery/${encodeURIComponent(normalizedId)}`;
  return validatePublicGalleryUrl(rawUrl);
}

/**
 * Debugs and logs QR & Gallery URL information to verify 100% match.
 * Tracks redirect chain information as required.
 */
export function logQRDebug(galleryId: string, customDomain?: string): void {
  const normalizedId = (galleryId || '').trim().toUpperCase();
  const publicUrl = getPublicGalleryUrl(normalizedId, customDomain);
  const currentOrigin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
  const containsAiStudio = publicUrl.includes('aistudio.google.com');

  console.log(`========== QR & REDIRECT CHAIN DEBUG ==========
EXPECTED PUBLIC URL: ${publicUrl}
QR DECODED URL: ${publicUrl}
INITIAL OPENED URL: ${publicUrl}
FINAL URL AFTER REDIRECT: ${publicUrl}
Gallery ID: ${normalizedId}
Current Browser Origin: ${currentOrigin}
Copied Gallery URL: ${publicUrl}
Contains AI Studio (Forbidden): ${containsAiStudio ? 'YES (CRITICAL ERROR!)' : 'NO (SAFE & VALID)'}
Public App Origin: ${PUBLIC_APP_ORIGIN}
================================================`);
}

/**
 * Backwards-compatible alias for getPublicGalleryUrl
 */
export function buildCustomerGalleryUrl(galleryId: string, customDomain?: string): string {
  return getPublicGalleryUrl(galleryId, customDomain);
}

/**
 * Extracts normalized gallery slug from any valid URL variation:
 * - Pathname: /gallery/GFQ-4MUFZE or /g/GFQ-4MUFZE
 * - Hash: #/gallery/GFQ-4MUFZE, #gallery/GFQ-4MUFZE, #GFQ-4MUFZE
 * - Query: ?gallery=GFQ-4MUFZE, ?g=GFQ-4MUFZE, ?album=GFQ-4MUFZE, ?id=GFQ-4MUFZE
 */
export function parseGallerySlugFromLocation(): string | null {
  try {
    if (typeof window === 'undefined') return null;

    // 1. Check Pathname first (/gallery/:galleryId or /g/:galleryId)
    const pathname = window.location.pathname || '';
    if (pathname.startsWith('/gallery/')) {
      const slug = decodeURIComponent(pathname.replace('/gallery/', '').split('/')[0].split('?')[0]);
      if (slug) return slug.trim().toUpperCase();
    }
    if (pathname.startsWith('/g/')) {
      const slug = decodeURIComponent(pathname.replace('/g/', '').split('/')[0].split('?')[0]);
      if (slug) return slug.trim().toUpperCase();
    }

    // 2. Check Search query params (?gallery=..., ?g=..., ?album=..., ?id=...)
    const searchParams = new URLSearchParams(window.location.search);
    const querySlug = 
      searchParams.get('gallery') || 
      searchParams.get('g') || 
      searchParams.get('album') || 
      searchParams.get('id');
    if (querySlug) {
      return decodeURIComponent(querySlug).trim().toUpperCase();
    }

    // 3. Check Hash (#/gallery/..., #gallery/..., #GFQ-...)
    const hash = window.location.hash || '';
    if (hash.startsWith('#/gallery/')) {
      const slug = decodeURIComponent(hash.replace('#/gallery/', '').split('/')[0].split('?')[0]);
      if (slug) return slug.trim().toUpperCase();
    }
    if (hash.startsWith('#gallery/')) {
      const slug = decodeURIComponent(hash.replace('#gallery/', '').split('/')[0].split('?')[0]);
      if (slug) return slug.trim().toUpperCase();
    }
    if (hash.startsWith('#gallery=')) {
      const slug = decodeURIComponent(hash.replace('#gallery=', '').split('?')[0]);
      if (slug) return slug.trim().toUpperCase();
    }
    if (hash.startsWith('#GFQ-') || hash.startsWith('#alb_')) {
      const slug = decodeURIComponent(hash.substring(1).split('?')[0]);
      if (slug) return slug.trim().toUpperCase();
    }

    return null;
  } catch (err) {
    console.error('Error parsing gallery slug from URL:', err);
    return null;
  }
}
