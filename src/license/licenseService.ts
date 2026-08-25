import { User } from 'firebase/auth';
import { LicenseValidationResult, LicenseAdminItem } from './licenseTypes';
import { getApiBaseUrl } from '../config/appConfig';

export const PRODUCT_ID = 'GALERIFOTOQR_CLOUD';

/**
 * Resolves the active Backend API base URL.
 * Prefers configured API_BASE_URL (for Cloud Run), otherwise uses current origin.
 */
export function resolveApiBaseUrl(): string {
  const configured = getApiBaseUrl();
  if (configured && configured.trim() !== '') {
    return configured.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return '';
}

/**
 * Checks the license status of the currently authenticated Google user.
 */
export async function checkLicenseStatus(user: User): Promise<LicenseValidationResult> {
  try {
    const idToken = await user.getIdToken(true);
    const baseUrl = resolveApiBaseUrl();
    const targetUrl = `${baseUrl}/api/license/status`;

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        idToken,
        productId: PRODUCT_ID,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        valid: false,
        status: errData.status || 'not_found',
        errorCode: errData.errorCode || 'STATUS_CHECK_FAILED',
        errorMessage: errData.errorMessage || 'Gagal memverifikasi status lisensi dengan server.',
      };
    }

    const data: LicenseValidationResult = await res.json();
    return data;
  } catch (error: any) {
    console.error('[LICENSE_SERVICE] Status check network error:', error);
    return {
      valid: false,
      status: 'not_found',
      errorCode: 'NETWORK_ERROR',
      errorMessage: 'Koneksi ke License Validation API terputus. Pastikan backend aktif.',
    };
  }
}

/**
 * Activates a pending license key with the current Google account.
 */
export async function activateLicense(
  user: User,
  licenseKey: string
): Promise<LicenseValidationResult> {
  try {
    const idToken = await user.getIdToken(true);
    const baseUrl = resolveApiBaseUrl();
    const targetUrl = `${baseUrl}/api/license/activate`;

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        idToken,
        licenseKey: licenseKey.trim(),
        productId: PRODUCT_ID,
      }),
    });

    const data: LicenseValidationResult = await res.json().catch(() => ({
      valid: false,
      status: 'not_found',
      errorCode: 'PARSE_ERROR',
      errorMessage: 'Respon server tidak valid.',
    }));

    return data;
  } catch (error: any) {
    console.error('[LICENSE_SERVICE] Activation network error:', error);
    return {
      valid: false,
      status: 'not_found',
      errorCode: 'NETWORK_ERROR',
      errorMessage: 'Gagal terhubung ke server aktivasi lisensi. Periksa koneksi internet Anda.',
    };
  }
}

/**
 * Developer API: Fetch all licenses list
 */
export async function fetchAdminLicenses(adminKey: string): Promise<{ success: boolean; licenses: LicenseAdminItem[]; error?: string }> {
  try {
    const baseUrl = resolveApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/license/admin/list`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, licenses: [], error: err.error || 'Autentikasi admin gagal' };
    }

    const data = await res.json();
    return { success: true, licenses: data.licenses || [] };
  } catch (err: any) {
    return { success: false, licenses: [], error: err.message };
  }
}

/**
 * Developer API: Create new license key
 */
export async function createAdminLicense(
  adminKey: string,
  params: {
    key?: string;
    plan: string;
    customerName?: string;
    expiresInDays?: number;
    notes?: string;
  }
): Promise<{ success: boolean; license?: LicenseAdminItem; error?: string }> {
  try {
    const baseUrl = resolveApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/license/admin/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey,
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error || 'Gagal membuat lisensi' };
    }

    const data = await res.json();
    return { success: true, license: data.license };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Developer API: Update license status / extend / reset binding
 */
export async function updateAdminLicense(
  adminKey: string,
  params: {
    licenseId: string;
    status?: string;
    extendDays?: number;
    unbindUid?: boolean;
  }
): Promise<{ success: boolean; license?: LicenseAdminItem; error?: string }> {
  try {
    const baseUrl = resolveApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/license/admin/update-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey,
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error || 'Gagal memperbarui lisensi' };
    }

    const data = await res.json();
    return { success: true, license: data.license };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
