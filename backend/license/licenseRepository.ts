import crypto from 'crypto';
import { LicenseDocument, LicensePlan, LicenseStatus } from './licenseTypes';

export const APP_PRODUCT_ID = 'GALERIFOTOQR_CLOUD';

export function normalizeLicenseKey(key: string): string {
  if (!key) return '';
  return key.trim().toUpperCase().replace(/[\s_]/g, '-');
}

export function hashLicenseKey(key: string): string {
  const normalized = normalizeLicenseKey(key);
  return crypto.createHash('sha256').update(`GFQ_SALT_${normalized}`).digest('hex');
}

export function generateRandomLicenseKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = (len: number) => {
    let s = '';
    for (let i = 0; i < len; i++) {
      s += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return s;
  };
  return `GFQ-${pick(4)}-${pick(4)}-${pick(4)}`;
}

// In-Memory persistent repository for quick response and fallback
const licenseStore: Map<string, LicenseDocument> = new Map();

/**
 * Pre-seed standard licenses if empty
 */
export function seedDefaultLicenses(): void {
  if (licenseStore.size > 0) return;

  const starterKeys: Array<{
    key: string;
    plan: LicensePlan;
    status: 'pending' | 'active';
    customerName: string;
    notes: string;
  }> = [
    {
      key: 'GFQ-DEMO-LIFE-2026',
      plan: 'lifetime',
      status: 'pending',
      customerName: 'Demo Pembeli Lifetime',
      notes: 'Starter Key: Paket Lifetime Permanen',
    },
    {
      key: 'GFQ-DEMO-YEAR-2026',
      plan: 'yearly',
      status: 'pending',
      customerName: 'Demo Pembeli Tahunan',
      notes: 'Starter Key: Paket 1 Tahun',
    },
    {
      key: 'GFQ-DEMO-MNTH-2026',
      plan: 'monthly',
      status: 'pending',
      customerName: 'Demo Pembeli Bulanan',
      notes: 'Starter Key: Paket 1 Bulan',
    },
    {
      key: 'GFQ-DEMO-TRIL-2026',
      plan: 'trial',
      status: 'pending',
      customerName: 'Demo Pengguna Trial',
      notes: 'Starter Key: Paket Trial 14 Hari',
    },
    {
      key: 'GFQ-GOLD-8899-7711',
      plan: 'lifetime',
      status: 'pending',
      customerName: 'Studio Partner Official',
      notes: 'VIP Lifetime Key',
    },
  ];

  for (const item of starterKeys) {
    const normKey = normalizeLicenseKey(item.key);
    const hash = hashLicenseKey(normKey);
    const doc: LicenseDocument = {
      licenseId: `lic_${hash.slice(0, 16)}`,
      licenseKey: normKey,
      licenseKeyHash: hash,
      productId: APP_PRODUCT_ID,
      googleUid: null,
      email: null,
      customerName: item.customerName,
      status: item.status,
      plan: item.plan,
      maxAccounts: 1,
      activatedAt: null,
      expiresAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: item.notes,
    };
    licenseStore.set(normKey, doc);
  }
}

seedDefaultLicenses();

export async function findLicenseByKey(key: string): Promise<LicenseDocument | null> {
  const normKey = normalizeLicenseKey(key);
  const doc = licenseStore.get(normKey);
  return doc ? { ...doc } : null;
}

export async function findLicenseByUidAndProduct(
  googleUid: string,
  productId: string
): Promise<LicenseDocument | null> {
  if (!googleUid) return null;
  for (const doc of licenseStore.values()) {
    if (doc.googleUid === googleUid && doc.productId === productId) {
      return { ...doc };
    }
  }
  return null;
}

export async function findLicenseById(licenseId: string): Promise<LicenseDocument | null> {
  for (const doc of licenseStore.values()) {
    if (doc.licenseId === licenseId) {
      return { ...doc };
    }
  }
  return null;
}

export async function saveLicense(doc: LicenseDocument): Promise<void> {
  doc.updatedAt = new Date().toISOString();
  licenseStore.set(doc.licenseKey, { ...doc });
}

export async function getAllLicenses(): Promise<LicenseDocument[]> {
  return Array.from(licenseStore.values()).map((d) => ({
    ...d,
    // Mask key partially in listing for safety if needed
    licenseKey: d.licenseKey,
  }));
}

export async function createNewLicense(params: {
  key?: string;
  productId?: string;
  plan: LicensePlan;
  customerName?: string;
  maxAccounts?: number;
  expiresInDays?: number;
  notes?: string;
}): Promise<LicenseDocument> {
  const normKey = normalizeLicenseKey(params.key || generateRandomLicenseKey());
  const hash = hashLicenseKey(normKey);

  let initialExpiresAt: string | null = null;
  if (params.expiresInDays && params.expiresInDays > 0) {
    const d = new Date();
    d.setDate(d.getDate() + params.expiresInDays);
    initialExpiresAt = d.toISOString();
  }

  const doc: LicenseDocument = {
    licenseId: `lic_${hash.slice(0, 16)}`,
    licenseKey: normKey,
    licenseKeyHash: hash,
    productId: params.productId || APP_PRODUCT_ID,
    googleUid: null,
    email: null,
    customerName: params.customerName || 'Pelanggan Studio',
    status: 'pending',
    plan: params.plan,
    maxAccounts: params.maxAccounts || 1,
    activatedAt: null,
    expiresAt: initialExpiresAt,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: params.notes || '',
  };

  licenseStore.set(normKey, doc);
  return doc;
}
