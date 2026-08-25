/**
 * GaleriFotoQR — Public URL Helper
 *
 * Single Source of Truth:
 * - QR Code
 * - Copy Link
 * - Open Gallery
 * - Public Gallery Navigation
 *
 * GitHub Pages production:
 * https://chyndra07.github.io/Cloud-Studio/
 */

export const PUBLIC_APP_ORIGIN =
  'https://chyndra07.github.io/Cloud-Studio';

export const FALLBACK_PRODUCTION_URL = PUBLIC_APP_ORIGIN;

let serverConfigAppUrl = '';

/**
 * Remove trailing slash.
 */
function removeTrailingSlash(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

/**
 * Normalize a base URL while preserving a GitHub Pages subpath.
 *
 * Example:
 * https://chyndra07.github.io/Cloud-Studio/
 * ->
 * https://chyndra07.github.io/Cloud-Studio
 */
function normalizeBaseUrl(value: string): string {
  return removeTrailingSlash(value);
}

/**
 * Returns true when an origin/base URL must never be used
 * as a customer-facing gallery destination.
 */
export function isInvalidPublicOrigin(origin: string): boolean {
  if (!origin) return true;

  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname.toLowerCase();

    return (
      hostname === 'aistudio.google.com' ||
      hostname.endsWith('.aistudio.google.com') ||
      hostname.startsWith('ais-dev-') ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.includes('webcontainer.io')
    );
  } catch {
    const value = origin.toLowerCase();

    return (
      value.includes('aistudio.google.com') ||
      value.includes('ais-dev-') ||
      value.includes('localhost') ||
      value.includes('127.0.0.1') ||
      value.includes('webcontainer.io')
    );
  }
}

/**
 * Sanitizes a public application base URL.
 *
 * IMPORTANT:
 * Do not use URL.origin here because GitHub Pages needs
 * the repository subpath:
 *
 * /Cloud-Studio
 */
export function sanitizePublicOrigin(rawOrigin: string): string {
  if (!rawOrigin) {
    return PUBLIC_APP_ORIGIN;
  }

  let value = normalizeBaseUrl(rawOrigin);

  if (value.includes('aistudio.google.com')) {
    return PUBLIC_APP_ORIGIN;
  }

  if (value.includes('ais-dev-')) {
    value = value.replace('ais-dev-', 'ais-pre-');
  }

  if (
    value.includes('localhost') ||
    value.includes('127.0.0.1') ||
    value.includes('webcontainer.io')
  ) {
    return PUBLIC_APP_ORIGIN;
  }

  if (
    value.startsWith('https://') ||
    value.startsWith('http://')
  ) {
    return normalizeBaseUrl(value);
  }

  return PUBLIC_APP_ORIGIN;
}

/**
 * Try to obtain optional server configuration.
 *
 * Failure is intentionally ignored because GitHub Pages
 * is a static deployment and /api/config may not exist.
 */
if (typeof window !== 'undefined') {
  fetch('/api/config')
    .then((res) => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      return res.json();
    })
    .then((data) => {
      if (data?.appUrl) {
        serverConfigAppUrl = sanitizePublicOrigin(data.appUrl);
      }
    })
    .catch(() => {
      // Expected on static GitHub Pages deployment.
    });
}

/**
 * Returns the configured production base URL.
 */
export function getProductionBaseUrl(): string {
  const envUrl =
    typeof import.meta !== 'undefined' &&
    (import.meta as any).env?.VITE_APP_URL
      ? String((import.meta as any).env.VITE_APP_URL).trim()
      : '';

  if (envUrl && !isInvalidPublicOrigin(envUrl)) {
    return sanitizePublicOrigin(envUrl);
  }

  if (
    serverConfigAppUrl &&
    !isInvalidPublicOrigin(serverConfigAppUrl)
  ) {
    return sanitizePublicOrigin(serverConfigAppUrl);
  }

  return PUBLIC_APP_ORIGIN;
}

/**
 * Detect GitHub Pages deployment.
 *
 * For this project:
 *
 * hostname:
 * chyndra07.github.io
 *
 * repository base:
 * /Cloud-Studio
 */
function getGitHubPagesBaseUrl(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const { protocol, hostname, pathname } = window.location;

  if (!hostname.endsWith('.github.io')) {
    return null;
  }

  const parts = pathname.split('/').filter(Boolean);

  /**
   * Project Pages URLs have:
   *
   * https://USER.github.io/REPOSITORY/...
   *
   * First pathname segment = repository name.
   */
  const repositoryName = parts[0];

  if (repositoryName) {
    return `${protocol}//${hostname}/${repositoryName}`;
  }

  /**
   * Safety fallback specifically for this application.
   */
  return PUBLIC_APP_ORIGIN;
}

/**
 * Returns the correct public application base URL.
 *
 * Priority:
 * 1. Custom domain
 * 2. GitHub Pages repository URL
 * 3. Valid public runtime URL
 * 4. Environment/server URL
 * 5. Hardcoded production fallback
 */
export function getAppBaseUrl(customDomain?: string): string {
  // -------------------------------------------------------
  // 1. CUSTOM DOMAIN
  // -------------------------------------------------------

  if (customDomain && customDomain.trim()) {
    let clean = customDomain.trim();

    if (
      !clean.startsWith('http://') &&
      !clean.startsWith('https://')
    ) {
      clean = `https://${clean}`;
    }

    const sanitized = sanitizePublicOrigin(clean);

    if (!isInvalidPublicOrigin(sanitized)) {
      return normalizeBaseUrl(sanitized);
    }
  }

  // -------------------------------------------------------
  // 2. GITHUB PAGES
  // -------------------------------------------------------

  const githubPagesBase = getGitHubPagesBaseUrl();

  if (githubPagesBase) {
    return normalizeBaseUrl(githubPagesBase);
  }

  // -------------------------------------------------------
  // 3. CURRENT PUBLIC RUNTIME
  // -------------------------------------------------------

  if (
    typeof window !== 'undefined' &&
    window.location &&
    window.location.origin &&
    window.location.origin !== 'null'
  ) {
    const rawOrigin = normalizeBaseUrl(
      window.location.origin
    );

    if (!isInvalidPublicOrigin(rawOrigin)) {
      return rawOrigin;
    }

    if (rawOrigin.includes('ais-dev-')) {
      return rawOrigin.replace(
        'ais-dev-',
        'ais-pre-'
      );
    }
  }

  // -------------------------------------------------------
  // 4. PRODUCTION FALLBACK
  // -------------------------------------------------------

  return getProductionBaseUrl();
}

/**
 * Extract gallery ID from a URL pathname.
 *
 * Supports:
 *
 * /gallery/GFQ-XXXX
 * /g/GFQ-XXXX
 *
 * and GitHub Pages:
 *
 * /Cloud-Studio/gallery/GFQ-XXXX
 */
function extractGalleryIdFromPath(
  pathname: string
): string {
  if (!pathname) return '';

  const segments = pathname
    .split('/')
    .filter(Boolean);

  const galleryIndex = segments.findIndex(
    (segment) =>
      segment.toLowerCase() === 'gallery' ||
      segment.toLowerCase() === 'g'
  );

  if (
    galleryIndex >= 0 &&
    segments[galleryIndex + 1]
  ) {
    return decodeURIComponent(
      segments[galleryIndex + 1]
    )
      .trim()
      .toUpperCase();
  }

  return '';
}

/**
 * Validates customer gallery URL.
 */
export function validatePublicGalleryUrl(
  url: string
): string {
  if (!url) return '';

  try {
    const parsed = new URL(
      url,
      PUBLIC_APP_ORIGIN
    );

    if (isInvalidPublicOrigin(parsed.origin)) {
      console.warn(
        '[INVALID_QR_URL]',
        'Invalid customer URL detected:',
        url
      );

      const galleryId =
        extractGalleryIdFromPath(parsed.pathname);

      if (!galleryId) {
        return PUBLIC_APP_ORIGIN;
      }

      return `${PUBLIC_APP_ORIGIN}/gallery/${encodeURIComponent(
        galleryId
      )}`;
    }

    if (url.includes('ais-dev-')) {
      return url.replace(
        'ais-dev-',
        'ais-pre-'
      );
    }

    return url;
  } catch (err) {
    console.error(
      'Error validating public gallery URL:',
      err
    );

    return '';
  }
}

/**
 * SINGLE SOURCE OF TRUTH
 *
 * Creates the public customer gallery URL.
 *
 * Expected GitHub Pages result:
 *
 * https://chyndra07.github.io/Cloud-Studio/gallery/GFQ-XXXXXX
 */
export function getPublicGalleryUrl(
  galleryId: string,
  customDomain?: string
): string {
  if (!galleryId) {
    return '';
  }

  const normalizedId = galleryId
    .trim()
    .toUpperCase();

  const baseUrl =
    getAppBaseUrl(customDomain);

  const galleryUrl =
    `${normalizeBaseUrl(baseUrl)}/gallery/` +
    encodeURIComponent(normalizedId);

  return validatePublicGalleryUrl(
    galleryUrl
  );
}

/**
 * Debug QR URL.
 */
export function logQRDebug(
  galleryId: string,
  customDomain?: string
): void {
  const normalizedId = (
    galleryId || ''
  )
    .trim()
    .toUpperCase();

  const publicUrl =
    getPublicGalleryUrl(
      normalizedId,
      customDomain
    );

  const currentUrl =
    typeof window !== 'undefined'
      ? window.location.href
      : '';

  const containsAiStudio =
    publicUrl.includes(
      'aistudio.google.com'
    );

  console.log(`
========== GALERIFOTOQR URL DEBUG ==========

Gallery ID:
${normalizedId}

Current Browser:
${currentUrl}

Application Base:
${getAppBaseUrl(customDomain)}

QR URL:
${publicUrl}

Copy Link:
${publicUrl}

Open Gallery:
${publicUrl}

Contains AI Studio:
${containsAiStudio ? 'YES - ERROR' : 'NO'}

Expected GitHub Pages format:
https://chyndra07.github.io/Cloud-Studio/gallery/${normalizedId}

============================================
`);
}

/**
 * Backwards compatible alias.
 */
export function buildCustomerGalleryUrl(
  galleryId: string,
  customDomain?: string
): string {
  return getPublicGalleryUrl(
    galleryId,
    customDomain
  );
}

/**
 * Extract gallery ID from current browser URL.
 *
 * Supports:
 *
 * /gallery/GFQ-XXXX
 * /g/GFQ-XXXX
 *
 * /Cloud-Studio/gallery/GFQ-XXXX
 * /Cloud-Studio/g/GFQ-XXXX
 *
 * ?gallery=GFQ-XXXX
 * ?g=GFQ-XXXX
 * ?album=GFQ-XXXX
 * ?id=GFQ-XXXX
 *
 * #/gallery/GFQ-XXXX
 * #gallery/GFQ-XXXX
 * #GFQ-XXXX
 */
export function parseGallerySlugFromLocation():
  string | null {
  try {
    if (typeof window === 'undefined') {
      return null;
    }

    // -------------------------------------------------------
    // 1. PATHNAME
    // -------------------------------------------------------

    const pathname =
      window.location.pathname || '';

    const pathGalleryId =
      extractGalleryIdFromPath(pathname);

    if (pathGalleryId) {
      return pathGalleryId;
    }

    // -------------------------------------------------------
    // 2. QUERY PARAMETERS
    // -------------------------------------------------------

    const searchParams =
      new URLSearchParams(
        window.location.search
      );

    const querySlug =
      searchParams.get('gallery') ||
      searchParams.get('g') ||
      searchParams.get('album') ||
      searchParams.get('id');

    if (querySlug) {
      return decodeURIComponent(querySlug)
        .trim()
        .toUpperCase();
    }

    // -------------------------------------------------------
    // 3. HASH ROUTES
    // -------------------------------------------------------

    const hash =
      window.location.hash || '';

    if (hash.startsWith('#/gallery/')) {
      const slug = decodeURIComponent(
        hash
          .replace('#/gallery/', '')
          .split('/')[0]
          .split('?')[0]
      );

      if (slug) {
        return slug
          .trim()
          .toUpperCase();
      }
    }

    if (hash.startsWith('#gallery/')) {
      const slug = decodeURIComponent(
        hash
          .replace('#gallery/', '')
          .split('/')[0]
          .split('?')[0]
      );

      if (slug) {
        return slug
          .trim()
          .toUpperCase();
      }
    }

    if (hash.startsWith('#gallery=')) {
      const slug = decodeURIComponent(
        hash
          .replace('#gallery=', '')
          .split('?')[0]
      );

      if (slug) {
        return slug
          .trim()
          .toUpperCase();
      }
    }

    if (
      hash.startsWith('#GFQ-') ||
      hash.startsWith('#alb_')
    ) {
      const slug = decodeURIComponent(
        hash
          .substring(1)
          .split('?')[0]
      );

      if (slug) {
        return slug
          .trim()
          .toUpperCase();
      }
    }

    return null;
  } catch (err) {
    console.error(
      'Error parsing gallery slug from URL:',
      err
    );

    return null;
  }
}
