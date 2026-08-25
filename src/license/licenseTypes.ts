export type LicenseStatus = 'pending' | 'active' | 'expired' | 'suspended' | 'disabled' | 'not_found';
export type LicensePlan = 'trial' | 'monthly' | 'yearly' | 'lifetime';

export interface LicensePublicData {
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

export interface LicenseValidationResult {
  valid: boolean;
  status: LicenseStatus;
  license?: LicensePublicData;
  errorCode?: string;
  errorMessage?: string;
  user?: {
    uid: string;
    email: string;
    name: string;
  };
}

export interface LicenseAdminItem {
  licenseId: string;
  licenseKey: string;
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
  updatedAt: string;
  notes?: string;
}
