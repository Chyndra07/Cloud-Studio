export type LicenseStatus = 'pending' | 'active' | 'expired' | 'suspended' | 'disabled' | 'not_found';
export type LicensePlan = 'trial' | 'monthly' | 'yearly' | 'lifetime';

export interface LicenseDocument {
  licenseId: string;
  licenseKey: string;
  licenseKeyHash: string;
  productId: string; // 'GALERIFOTOQR_CLOUD'
  googleUid: string | null;
  email: string | null;
  customerName: string | null;
  status: 'pending' | 'active' | 'expired' | 'suspended' | 'disabled';
  plan: LicensePlan;
  maxAccounts: number;
  activatedAt: string | null; // ISO timestamp
  expiresAt: string | null;   // ISO timestamp or null for lifetime
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface LicensePublicInfo {
  licenseId: string;
  productId: string;
  googleUid: string | null;
  email: string | null;
  customerName: string | null;
  status: LicenseStatus;
  plan: LicensePlan;
  maxAccounts: number;
  activatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface VerifiedGoogleUser {
  uid: string;
  email: string;
  name: string;
  picture?: string;
}
