import { User } from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  LicensePublicData,
  LicenseValidationResult,
  LicenseAdminItem,
  LicensePlan,
  LicenseStatus,
} from './licenseTypes';
import { getApiBaseUrl } from '../config/appConfig';

export const PRODUCT_ID = 'GALERIFOTOQR_CLOUD';

// Local storage backup keys
const getLocalLicenseKey = (uid: string) => `gfq_license_${uid}`;
const LOCAL_CATALOG_KEY = 'gfq_admin_licenses_catalog';

// Accepted developer admin keys
const ACCEPTED_ADMIN_KEYS = new Set(['developer', 'admin123', 'sevenstudio', 'gfq2026']);

/**
 * Normalizes a license key to uppercase hyphenated format.
 */
export function normalizeLicenseKey(key: string): string {
  if (!key) return '';
  return key.trim().toUpperCase().replace(/[\s_]/g, '-');
}

/**
 * Timeout helper for Firestore operations to avoid hanging promises on slow connections.
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 6000,
  errorMsg: string = 'Operasi Firestore timeout'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMsg)), timeoutMs)
    ),
  ]);
}

/**
 * Starter demo keys available out-of-the-box.
 */
export const STARTER_LICENSES: Array<{
  key: string;
  plan: LicensePlan;
  customerName: string;
  expiresInDays: number | null;
  notes: string;
}> = [
  {
    key: 'GFQ-DEMO-LIFE-2026',
    plan: 'lifetime',
    customerName: 'Demo Pembeli Lifetime',
    expiresInDays: null,
    notes: 'Kunci Demo: Paket Lifetime Permanen',
  },
  {
    key: 'GFQ-DEMO-YEAR-2026',
    plan: 'yearly',
    customerName: 'Demo Pembeli Tahunan',
    expiresInDays: 365,
    notes: 'Kunci Demo: Paket 1 Tahun',
  },
  {
    key: 'GFQ-DEMO-MNTH-2026',
    plan: 'monthly',
    customerName: 'Demo Pembeli Bulanan',
    expiresInDays: 30,
    notes: 'Kunci Demo: Paket 1 Bulan',
  },
  {
    key: 'GFQ-DEMO-TRIL-2026',
    plan: 'trial',
    customerName: 'Demo Pengguna Trial',
    expiresInDays: 14,
    notes: 'Kunci Demo: Paket Trial 14 Hari',
  },
  {
    key: 'GFQ-GOLD-8899-7711',
    plan: 'lifetime',
    customerName: 'Studio Partner Official',
    expiresInDays: null,
    notes: 'VIP Lifetime Key',
  },
];

/**
 * Resolves the active Backend API base URL if explicitly configured.
 */
export function resolveApiBaseUrl(): string {
  const configured = getApiBaseUrl();
  if (configured && configured.trim() !== '') {
    return configured.trim().replace(/\/+$/, '');
  }
  return '';
}

/**
 * Determines if we are running in an environment with a dedicated Node backend.
 */
function hasConfiguredBackend(): boolean {
  const url = resolveApiBaseUrl();
  if (!url) return false;
  const lower = url.toLowerCase();
  // If pointed to GitHub Pages or static host, it doesn't have an Express backend
  if (lower.includes('github.io')) return false;
  return true;
}

// ---------------------------------------------------------------------------
// LOCAL STORAGE & FIRESTORE CATALOG HELPERS
// ---------------------------------------------------------------------------

function getLocalCatalog(): LicenseAdminItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_CATALOG_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[LICENSE] Failed to read local catalog:', err);
  }
  return [];
}

function saveLocalCatalog(items: LicenseAdminItem[]): void {
  try {
    localStorage.setItem(LOCAL_CATALOG_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('[LICENSE] Failed to save local catalog:', err);
  }
}

/**
 * Builds the initial catalog combining Starter Keys with any existing items.
 */
function initializeDefaultCatalog(): LicenseAdminItem[] {
  const existing = getLocalCatalog();
  const existingKeys = new Set(existing.map((item) => normalizeLicenseKey(item.licenseKey)));
  const now = new Date().toISOString();

  const seeded: LicenseAdminItem[] = [...existing];

  for (const starter of STARTER_LICENSES) {
    const normKey = normalizeLicenseKey(starter.key);
    if (!existingKeys.has(normKey)) {
      seeded.push({
        licenseId: `lic_${normKey.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        licenseKey: normKey,
        productId: PRODUCT_ID,
        googleUid: null,
        email: null,
        customerName: starter.customerName,
        status: 'pending',
        plan: starter.plan,
        maxAccounts: 1,
        activatedAt: null,
        expiresAt: null,
        createdAt: now,
        updatedAt: now,
        notes: starter.notes,
      });
      existingKeys.add(normKey);
    }
  }

  saveLocalCatalog(seeded);
  return seeded;
}

// ---------------------------------------------------------------------------
// PUBLIC API: CHECK LICENSE STATUS
// ---------------------------------------------------------------------------

/**
 * Checks the license status of the currently authenticated Google user.
 * Seamlessly verifies against Firestore and LocalStorage with backend API fallback.
 */
export async function checkLicenseStatus(user: User): Promise<LicenseValidationResult> {
  if (!user || !user.uid) {
    return {
      valid: false,
      status: 'not_found',
      errorCode: 'NO_USER',
      errorMessage: 'Pengguna tidak terautentikasi.',
    };
  }

  // 1. Try external backend API if explicitly configured
  if (hasConfiguredBackend()) {
    try {
      const idToken = await user.getIdToken(true);
      const baseUrl = resolveApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/license/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ idToken, productId: PRODUCT_ID }),
      });

      if (res.ok) {
        const data: LicenseValidationResult = await res.json();
        if (data && typeof data.valid === 'boolean') {
          if (data.valid && data.license) {
            localStorage.setItem(getLocalLicenseKey(user.uid), JSON.stringify(data.license));
          }
          return data;
        }
      }
    } catch (apiErr) {
      console.warn('[LICENSE] Backend status check failed, using Firestore engine:', apiErr);
    }
  }

  // 2. Check Firestore (Primary Single Source of Truth on GitHub Pages / Static Hosting)
  try {
    const studioDocRef = doc(db, 'studios', user.uid);
    const snap = await withTimeout(getDoc(studioDocRef), 5000, 'Check license timeout');

    if (snap.exists()) {
      const studioData = snap.data();
      const lic = studioData?.license as LicensePublicData | undefined;

      if (lic && lic.licenseId) {
        // Verify expiration
        if (lic.status === 'active' && lic.expiresAt) {
          const isExpired = new Date(lic.expiresAt).getTime() < Date.now();
          if (isExpired) {
            lic.status = 'expired';
            // Update Firestore async
            setDoc(studioDocRef, { license: { status: 'expired' } }, { merge: true }).catch(() => {});
          }
        }

        // Verify UID match
        if (lic.googleUid && lic.googleUid !== user.uid) {
          return {
            valid: false,
            status: 'disabled',
            errorCode: 'UID_MISMATCH',
            errorMessage: 'Lisensi terikat pada akun Google lain.',
          };
        }

        const isValid = lic.status === 'active';
        localStorage.setItem(getLocalLicenseKey(user.uid), JSON.stringify(lic));

        return {
          valid: isValid,
          status: lic.status,
          license: lic,
          user: {
            uid: user.uid,
            email: user.email || '',
            name: user.displayName || 'Studio Owner',
          },
        };
      }
    }
  } catch (firestoreErr) {
    console.warn('[LICENSE] Firestore read failed, checking local cache:', firestoreErr);
  }

  // 3. Fallback to LocalStorage cache
  try {
    const cached = localStorage.getItem(getLocalLicenseKey(user.uid));
    if (cached) {
      const lic: LicensePublicData = JSON.parse(cached);
      if (lic && lic.licenseId) {
        if (lic.status === 'active' && lic.expiresAt) {
          const isExpired = new Date(lic.expiresAt).getTime() < Date.now();
          if (isExpired) {
            lic.status = 'expired';
          }
        }
        return {
          valid: lic.status === 'active',
          status: lic.status,
          license: lic,
          user: {
            uid: user.uid,
            email: user.email || '',
            name: user.displayName || 'Studio Owner',
          },
        };
      }
    }
  } catch (cacheErr) {
    console.warn('[LICENSE] Local cache read error:', cacheErr);
  }

  // 4. No license found for this user
  return {
    valid: false,
    status: 'not_found',
    errorCode: 'LICENSE_NOT_FOUND',
    errorMessage: 'Akun Google Anda belum terdaftar dengan lisensi aktif.',
    user: {
      uid: user.uid,
      email: user.email || '',
      name: user.displayName || 'Studio Owner',
    },
  };
}

// ---------------------------------------------------------------------------
// PUBLIC API: ACTIVATE LICENSE
// ---------------------------------------------------------------------------

/**
 * Activates a pending license key with the current Google account.
 * Supports Starter Keys, Firestore catalog, and external API backend.
 */
export async function activateLicense(
  user: User,
  rawLicenseKey: string
): Promise<LicenseValidationResult> {
  const normKey = normalizeLicenseKey(rawLicenseKey);

  if (!normKey) {
    return {
      valid: false,
      status: 'not_found',
      errorCode: 'LICENSE_INVALID',
      errorMessage: 'Format kode lisensi tidak valid.',
    };
  }

  // 1. Try external backend API if explicitly configured
  if (hasConfiguredBackend()) {
    try {
      const idToken = await user.getIdToken(true);
      const baseUrl = resolveApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/license/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          idToken,
          licenseKey: normKey,
          productId: PRODUCT_ID,
        }),
      });

      if (res.ok) {
        const data: LicenseValidationResult = await res.json();
        if (data && data.valid && data.license) {
          localStorage.setItem(getLocalLicenseKey(user.uid), JSON.stringify(data.license));
          return data;
        }
      }
    } catch (apiErr) {
      console.warn('[LICENSE] Backend activation failed, falling back to client/Firestore engine:', apiErr);
    }
  }

  // 2. Client & Firestore Hybrid Activation Engine
  // Look for license in:
  // A) Starter Keys
  // B) Firestore catalog under studios/_system_licenses_/catalog/{normKey}
  // C) LocalStorage catalog
  try {
    let matchedItem: LicenseAdminItem | null = null;

    // Check Starter Keys first
    const starterMatch = STARTER_LICENSES.find(
      (s) => normalizeLicenseKey(s.key) === normKey
    );

    if (starterMatch) {
      matchedItem = {
        licenseId: `lic_${normKey.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        licenseKey: normKey,
        productId: PRODUCT_ID,
        googleUid: null,
        email: null,
        customerName: starterMatch.customerName,
        status: 'pending',
        plan: starterMatch.plan,
        maxAccounts: 1,
        activatedAt: null,
        expiresAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: starterMatch.notes,
      };
    }

    // Check Firestore catalog if not found in starter keys
    if (!matchedItem) {
      try {
        const catalogDocRef = doc(db, 'studios', '_system_licenses_', 'catalog', normKey);
        const snap = await withTimeout(getDoc(catalogDocRef), 4000, 'Get catalog timeout');
        if (snap.exists()) {
          matchedItem = snap.data() as LicenseAdminItem;
        }
      } catch (fErr) {
        console.warn('[LICENSE] Firestore catalog read skipped:', fErr);
      }
    }

    // Check LocalStorage catalog
    if (!matchedItem) {
      const catalog = getLocalCatalog();
      const found = catalog.find((c) => normalizeLicenseKey(c.licenseKey) === normKey);
      if (found) {
        matchedItem = { ...found };
      }
    }

    // If still not found
    if (!matchedItem) {
      return {
        valid: false,
        status: 'not_found',
        errorCode: 'LICENSE_NOT_FOUND',
        errorMessage: 'Kode lisensi tidak ditemukan di server. Pastikan kode yang dimasukkan benar.',
      };
    }

    // Check status
    if (matchedItem.status === 'suspended') {
      return {
        valid: false,
        status: 'suspended',
        errorCode: 'LICENSE_SUSPENDED',
        errorMessage: 'Lisensi ini sedang ditangguhkan. Hubungi admin/penjual untuk mengaktifkan kembali.',
      };
    }

    if (matchedItem.status === 'disabled') {
      return {
        valid: false,
        status: 'disabled',
        errorCode: 'LICENSE_DISABLED',
        errorMessage: 'Lisensi ini telah dinonaktifkan oleh developer.',
      };
    }

    // Check if already bound to another account (anti-sharing protection)
    if (matchedItem.googleUid && matchedItem.googleUid !== user.uid) {
      return {
        valid: false,
        status: 'disabled',
        errorCode: 'LICENSE_ALREADY_USED',
        errorMessage: `Lisensi ini sudah terdaftar dan diikat pada akun Google lain (${matchedItem.email || 'Akun Lain'}).`,
      };
    }

    // Calculate expiration date
    let calculatedExpiresAt: string | null = null;
    if (matchedItem.plan !== 'lifetime') {
      let days = 30; // default monthly
      if (matchedItem.plan === 'yearly') days = 365;
      else if (matchedItem.plan === 'trial') days = 14;

      const starter = STARTER_LICENSES.find((s) => normalizeLicenseKey(s.key) === normKey);
      if (starter && starter.expiresInDays) {
        days = starter.expiresInDays;
      }

      const expDate = new Date();
      expDate.setDate(expDate.getDate() + days);
      calculatedExpiresAt = expDate.toISOString();
    }

    const nowIso = new Date().toISOString();

    // Construct the activated public license data
    const activatedLicense: LicensePublicData = {
      licenseId: matchedItem.licenseId,
      productId: PRODUCT_ID,
      googleUid: user.uid,
      email: user.email || '',
      customerName: user.displayName || matchedItem.customerName || 'Studio Owner',
      status: 'active',
      plan: matchedItem.plan,
      maxAccounts: 1,
      activatedAt: nowIso,
      expiresAt: calculatedExpiresAt,
      createdAt: matchedItem.createdAt || nowIso,
    };

    // 1. Save to User Studio Firestore document
    try {
      const studioDocRef = doc(db, 'studios', user.uid);
      await withTimeout(
        setDoc(studioDocRef, { license: activatedLicense }, { merge: true }),
        6000,
        'Save studio license timeout'
      );
    } catch (saveErr) {
      console.warn('[LICENSE] Firestore save to studios/{uid} failed, will rely on local storage:', saveErr);
    }

    // 2. Update Firestore catalog document
    try {
      const catalogDocRef = doc(db, 'studios', '_system_licenses_', 'catalog', normKey);
      const updatedCatalogItem: LicenseAdminItem = {
        ...matchedItem,
        googleUid: user.uid,
        email: user.email || '',
        customerName: user.displayName || matchedItem.customerName || 'Studio Owner',
        status: 'active',
        activatedAt: nowIso,
        expiresAt: calculatedExpiresAt,
        updatedAt: nowIso,
      };
      await withTimeout(
        setDoc(catalogDocRef, updatedCatalogItem, { merge: true }),
        5000,
        'Save catalog timeout'
      );
    } catch (catSaveErr) {
      console.warn('[LICENSE] Firestore catalog save skipped:', catSaveErr);
    }

    // 3. Save to LocalStorage
    localStorage.setItem(getLocalLicenseKey(user.uid), JSON.stringify(activatedLicense));

    // Update LocalStorage catalog
    const catalog = getLocalCatalog();
    const idx = catalog.findIndex((c) => normalizeLicenseKey(c.licenseKey) === normKey);
    const updatedAdminItem: LicenseAdminItem = {
      ...matchedItem,
      googleUid: user.uid,
      email: user.email || '',
      customerName: user.displayName || matchedItem.customerName || 'Studio Owner',
      status: 'active',
      activatedAt: nowIso,
      expiresAt: calculatedExpiresAt,
      updatedAt: nowIso,
    };
    if (idx >= 0) {
      catalog[idx] = updatedAdminItem;
    } else {
      catalog.push(updatedAdminItem);
    }
    saveLocalCatalog(catalog);

    return {
      valid: true,
      status: 'active',
      license: activatedLicense,
      user: {
        uid: user.uid,
        email: user.email || '',
        name: user.displayName || 'Studio Owner',
      },
    };
  } catch (error: any) {
    console.error('[LICENSE] Activation error:', error);
    return {
      valid: false,
      status: 'not_found',
      errorCode: 'ACTIVATION_ERROR',
      errorMessage: error?.message || 'Gagal mengaktifkan lisensi. Silakan coba kembali.',
    };
  }
}

// ---------------------------------------------------------------------------
// DEVELOPER ADMIN API
// ---------------------------------------------------------------------------

function isAuthorizedAdmin(key: string): boolean {
  if (!key) return false;
  return ACCEPTED_ADMIN_KEYS.has(key.trim().toLowerCase());
}

/**
 * Developer API: Fetch all licenses list
 */
export async function fetchAdminLicenses(
  adminKey: string
): Promise<{ success: boolean; licenses: LicenseAdminItem[]; error?: string }> {
  if (!isAuthorizedAdmin(adminKey)) {
    return { success: false, licenses: [], error: 'Password Developer Salah' };
  }

  // 1. Try backend API if configured
  if (hasConfiguredBackend()) {
    try {
      const baseUrl = resolveApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/license/admin/list`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.licenses) {
          saveLocalCatalog(data.licenses);
          return { success: true, licenses: data.licenses };
        }
      }
    } catch (err) {
      console.warn('[LICENSE] Admin API call failed, using Firestore catalog:', err);
    }
  }

  // 2. Fetch from Firestore catalog
  try {
    const catalogColRef = collection(db, 'studios', '_system_licenses_', 'catalog');
    const snap = await withTimeout(getDocs(catalogColRef), 5000, 'Get catalog docs timeout');

    if (!snap.empty) {
      const docs: LicenseAdminItem[] = [];
      snap.forEach((d) => {
        docs.push(d.data() as LicenseAdminItem);
      });
      saveLocalCatalog(docs);
      return { success: true, licenses: docs };
    }
  } catch (err) {
    console.warn('[LICENSE] Firestore catalog fetch error:', err);
  }

  // 3. Fallback to Initial / LocalStorage Catalog
  const localItems = initializeDefaultCatalog();
  return { success: true, licenses: localItems };
}

/**
 * Developer API: Create new license key
 */
export async function createAdminLicense(
  adminKey: string,
  params: {
    key?: string;
    plan: LicensePlan;
    customerName?: string;
    expiresInDays?: number;
    notes?: string;
  }
): Promise<{ success: boolean; license?: LicenseAdminItem; error?: string }> {
  if (!isAuthorizedAdmin(adminKey)) {
    return { success: false, error: 'Password Developer Salah' };
  }

  // Generate random key if not provided
  let keyToUse = params.key ? normalizeLicenseKey(params.key) : '';
  if (!keyToUse) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const pick = (len: number) => {
      let s = '';
      for (let i = 0; i < len; i++) {
        s += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return s;
    };
    keyToUse = `GFQ-${pick(4)}-${pick(4)}-${pick(4)}`;
  }

  let initialExpiresAt: string | null = null;
  if (params.expiresInDays && params.expiresInDays > 0) {
    const d = new Date();
    d.setDate(d.getDate() + params.expiresInDays);
    initialExpiresAt = d.toISOString();
  }

  const now = new Date().toISOString();
  const newItem: LicenseAdminItem = {
    licenseId: `lic_${keyToUse.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    licenseKey: keyToUse,
    productId: PRODUCT_ID,
    googleUid: null,
    email: null,
    customerName: params.customerName || 'Pelanggan Baru',
    status: 'pending',
    plan: params.plan,
    maxAccounts: 1,
    activatedAt: null,
    expiresAt: initialExpiresAt,
    createdAt: now,
    updatedAt: now,
    notes: params.notes || '',
  };

  // 1. Try Backend API if configured
  if (hasConfiguredBackend()) {
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
      if (res.ok) {
        const data = await res.json();
        if (data.license) {
          return { success: true, license: data.license };
        }
      }
    } catch (err) {
      console.warn('[LICENSE] Backend create failed, saving to Firestore & local:', err);
    }
  }

  // 2. Save to Firestore catalog
  try {
    const catalogDocRef = doc(db, 'studios', '_system_licenses_', 'catalog', keyToUse);
    await withTimeout(setDoc(catalogDocRef, newItem), 5000, 'Save catalog timeout');
  } catch (err) {
    console.warn('[LICENSE] Firestore save catalog failed:', err);
  }

  // 3. Save to LocalStorage catalog
  const catalog = getLocalCatalog();
  catalog.unshift(newItem);
  saveLocalCatalog(catalog);

  return { success: true, license: newItem };
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
  if (!isAuthorizedAdmin(adminKey)) {
    return { success: false, error: 'Password Developer Salah' };
  }

  // 1. Try Backend API if configured
  if (hasConfiguredBackend()) {
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
      if (res.ok) {
        const data = await res.json();
        if (data.license) {
          return { success: true, license: data.license };
        }
      }
    } catch (err) {
      console.warn('[LICENSE] Backend update failed, using client engine:', err);
    }
  }

  // 2. Update locally and in Firestore
  const catalog = getLocalCatalog();
  const item = catalog.find((c) => c.licenseId === params.licenseId);

  if (!item) {
    return { success: false, error: 'Lisensi tidak ditemukan.' };
  }

  const previousUid = item.googleUid;
  const now = new Date().toISOString();

  if (params.status) {
    item.status = params.status as LicenseStatus;
  }

  if (params.extendDays && params.extendDays > 0) {
    const baseDate = item.expiresAt ? new Date(item.expiresAt) : new Date();
    baseDate.setDate(baseDate.getDate() + params.extendDays);
    item.expiresAt = baseDate.toISOString();
    if (item.status === 'expired') {
      item.status = 'active';
    }
  }

  if (params.unbindUid) {
    item.googleUid = null;
    item.email = null;
    item.status = 'pending';
    item.activatedAt = null;
  }

  item.updatedAt = now;

  // Save to LocalStorage catalog
  saveLocalCatalog(catalog);

  // Update in Firestore catalog
  try {
    const catalogDocRef = doc(db, 'studios', '_system_licenses_', 'catalog', item.licenseKey);
    await withTimeout(setDoc(catalogDocRef, item, { merge: true }), 5000, 'Update catalog timeout');
  } catch (err) {
    console.warn('[LICENSE] Firestore catalog update error:', err);
  }

  // If bound UID changed/unbound or status updated, sync to the Studio's Firestore document
  if (previousUid) {
    try {
      const studioDocRef = doc(db, 'studios', previousUid);
      if (params.unbindUid) {
        await withTimeout(
          setDoc(studioDocRef, { license: { status: 'not_found' } }, { merge: true }),
          5000,
          'Unbind studio license timeout'
        );
        localStorage.removeItem(getLocalLicenseKey(previousUid));
      } else if (params.status) {
        await withTimeout(
          setDoc(studioDocRef, { license: { status: params.status } }, { merge: true }),
          5000,
          'Update studio license status timeout'
        );
      }
    } catch (err) {
      console.warn('[LICENSE] Firestore studio license update error:', err);
    }
  }

  return { success: true, license: item };
}
