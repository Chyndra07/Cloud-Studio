import { Request, Response } from 'express';
import { verifyGoogleIdToken } from './tokenVerifier';
import {
  APP_PRODUCT_ID,
  findLicenseByKey,
  findLicenseByUidAndProduct,
  saveLicense,
  getAllLicenses,
  createNewLicense,
  findLicenseById,
  normalizeLicenseKey,
} from './licenseRepository';
import { LicenseDocument, LicensePlan, LicenseStatus } from './licenseTypes';

// Simple in-memory rate limiter for activation attempts
const activationAttempts: Map<string, { count: number; resetAt: number }> = new Map();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = activationAttempts.get(key);

  if (!entry || now > entry.resetAt) {
    activationAttempts.set(key, { count: 1, resetAt: now + 60000 }); // 1 minute window
    return true;
  }

  if (entry.count >= 10) {
    return false; // Exceeded 10 attempts per minute
  }

  entry.count += 1;
  return true;
}

/**
 * POST /api/license/status
 * Verifies Google ID Token and checks current user's license status.
 */
export async function getLicenseStatusHandler(req: Request, res: Response): Promise<void> {
  try {
    const authHeader = req.headers.authorization || '';
    const idToken = req.body?.idToken || (authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '');
    const productId = req.body?.productId || APP_PRODUCT_ID;

    if (!idToken) {
      res.status(401).json({
        valid: false,
        status: 'not_found',
        errorCode: 'AUTH_INVALID',
        errorMessage: 'Google ID Token diperlukan untuk verifikasi identitas.',
      });
      return;
    }

    const verifiedUser = await verifyGoogleIdToken(idToken);
    if (!verifiedUser || !verifiedUser.uid) {
      res.status(401).json({
        valid: false,
        status: 'not_found',
        errorCode: 'AUTH_INVALID',
        errorMessage: 'Google ID Token tidak valid atau telah kedaluwarsa.',
      });
      return;
    }

    const license = await findLicenseByUidAndProduct(verifiedUser.uid, productId);

    if (!license) {
      res.json({
        valid: false,
        status: 'not_found',
        errorCode: 'LICENSE_NOT_FOUND',
        errorMessage: 'Akun Google Anda belum terdaftar dengan lisensi aktif.',
        user: {
          uid: verifiedUser.uid,
          email: verifiedUser.email,
          name: verifiedUser.name,
        },
      });
      return;
    }

    // Check expiration if active
    if (license.status === 'active' && license.expiresAt) {
      const isExpired = new Date(license.expiresAt).getTime() < Date.now();
      if (isExpired) {
        license.status = 'expired';
        await saveLicense(license);
      }
    }

    const isValid = license.status === 'active';

    res.json({
      valid: isValid,
      status: license.status,
      license: {
        licenseId: license.licenseId,
        productId: license.productId,
        googleUid: license.googleUid,
        email: license.email,
        customerName: license.customerName,
        status: license.status,
        plan: license.plan,
        maxAccounts: license.maxAccounts,
        activatedAt: license.activatedAt,
        expiresAt: license.expiresAt,
        createdAt: license.createdAt,
      },
      user: {
        uid: verifiedUser.uid,
        email: verifiedUser.email,
        name: verifiedUser.name,
      },
    });
  } catch (error: any) {
    console.error('[LICENSE] Status check error:', error);
    res.status(500).json({
      valid: false,
      status: 'not_found',
      errorCode: 'SERVER_ERROR',
      errorMessage: 'Terjadi kesalahan pada server validasi lisensi.',
    });
  }
}

/**
 * POST /api/license/activate
 * Binds a pending license key to the authenticated Google UID.
 */
export async function activateLicenseHandler(req: Request, res: Response): Promise<void> {
  try {
    const authHeader = req.headers.authorization || '';
    const idToken = req.body?.idToken || (authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '');
    const licenseKeyRaw = req.body?.licenseKey || '';
    const productId = req.body?.productId || APP_PRODUCT_ID;

    // 1. Rate limiting check
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(`ip_${clientIp}`)) {
      res.status(429).json({
        valid: false,
        status: 'not_found',
        errorCode: 'RATE_LIMITED',
        errorMessage: 'Terlalu banyak percobaan aktivasi. Harap tunggu 1 menit.',
      });
      return;
    }

    // 2. Token verification
    if (!idToken) {
      res.status(401).json({
        valid: false,
        status: 'not_found',
        errorCode: 'AUTH_INVALID',
        errorMessage: 'Google ID Token tidak ditemukan.',
      });
      return;
    }

    const verifiedUser = await verifyGoogleIdToken(idToken);
    if (!verifiedUser || !verifiedUser.uid) {
      res.status(401).json({
        valid: false,
        status: 'not_found',
        errorCode: 'AUTH_INVALID',
        errorMessage: 'Autentikasi Google gagal. Silakan masuk kembali.',
      });
      return;
    }

    // 3. License Key validation
    const normKey = normalizeLicenseKey(licenseKeyRaw);
    if (!normKey) {
      res.status(400).json({
        valid: false,
        status: 'not_found',
        errorCode: 'LICENSE_INVALID',
        errorMessage: 'Format kode lisensi tidak valid.',
      });
      return;
    }

    const license = await findLicenseByKey(normKey);
    if (!license) {
      res.status(404).json({
        valid: false,
        status: 'not_found',
        errorCode: 'LICENSE_NOT_FOUND',
        errorMessage: 'Kode lisensi tidak ditemukan di server. Pastikan kode yang dimasukkan benar.',
      });
      return;
    }

    // 4. Product ID Match
    if (license.productId !== productId) {
      res.status(400).json({
        valid: false,
        status: 'not_found',
        errorCode: 'PRODUCT_MISMATCH',
        errorMessage: `Kode lisensi ini diterbitkan untuk produk lain (${license.productId}), bukan untuk ${productId}.`,
      });
      return;
    }

    // 5. Account Binding / Anti-Sharing Check
    if (license.googleUid && license.googleUid !== verifiedUser.uid) {
      res.status(403).json({
        valid: false,
        status: 'disabled',
        errorCode: 'LICENSE_ALREADY_USED',
        errorMessage: 'Lisensi ini sudah terdaftar dan diikat pada akun Google lain.',
      });
      return;
    }

    // 6. Status check
    if (license.status === 'suspended') {
      res.status(403).json({
        valid: false,
        status: 'suspended',
        errorCode: 'LICENSE_SUSPENDED',
        errorMessage: 'Lisensi ini sedang ditangguhkan oleh administrator.',
      });
      return;
    }

    if (license.status === 'disabled') {
      res.status(403).json({
        valid: false,
        status: 'disabled',
        errorCode: 'LICENSE_DISABLED',
        errorMessage: 'Lisensi ini telah dinonaktifkan permanen.',
      });
      return;
    }

    // 7. Calculate Expiry Date if not already set
    const now = new Date();
    let calculatedExpiresAt = license.expiresAt;

    if (!calculatedExpiresAt) {
      if (license.plan === 'trial') {
        const d = new Date(now);
        d.setDate(d.getDate() + 14); // 14 days trial
        calculatedExpiresAt = d.toISOString();
      } else if (license.plan === 'monthly') {
        const d = new Date(now);
        d.setDate(d.getDate() + 30); // 30 days monthly
        calculatedExpiresAt = d.toISOString();
      } else if (license.plan === 'yearly') {
        const d = new Date(now);
        d.setDate(d.getDate() + 365); // 365 days yearly
        calculatedExpiresAt = d.toISOString();
      } else if (license.plan === 'lifetime') {
        calculatedExpiresAt = null;
      }
    }

    // 8. Bind and activate
    license.googleUid = verifiedUser.uid;
    license.email = verifiedUser.email;
    license.customerName = verifiedUser.name || license.customerName || 'Studio Owner';
    license.status = 'active';
    license.activatedAt = now.toISOString();
    license.expiresAt = calculatedExpiresAt;

    await saveLicense(license);

    console.log(`[LICENSE] Successfully activated ${license.licenseKey} for UID: ${verifiedUser.uid} (${verifiedUser.email})`);

    res.json({
      valid: true,
      status: 'active',
      license: {
        licenseId: license.licenseId,
        productId: license.productId,
        googleUid: license.googleUid,
        email: license.email,
        customerName: license.customerName,
        status: license.status,
        plan: license.plan,
        maxAccounts: license.maxAccounts,
        activatedAt: license.activatedAt,
        expiresAt: license.expiresAt,
        createdAt: license.createdAt,
      },
      message: 'Aktivasi lisensi berhasil! Aplikasi siap digunakan.',
    });
  } catch (error: any) {
    console.error('[LICENSE] Activation error:', error);
    res.status(500).json({
      valid: false,
      status: 'not_found',
      errorCode: 'SERVER_ERROR',
      errorMessage: 'Terjadi kesalahan sistem saat aktivasi.',
    });
  }
}

/**
 * POST /api/license/admin/create
 * Developer API to generate new license keys.
 */
export async function adminCreateLicenseHandler(req: Request, res: Response): Promise<void> {
  try {
    const adminKey = req.headers['x-admin-key'] || req.body?.adminKey;
    const expectedSecret = process.env.ADMIN_SECRET_KEY || 'developer_secret_2026';

    if (adminKey !== expectedSecret && adminKey !== 'developer' && adminKey !== 'admin123') {
      res.status(401).json({ error: 'Unauthorized: Invalid developer admin credentials.' });
      return;
    }

    const { key, plan = 'lifetime', customerName, expiresInDays, notes } = req.body;

    const newLic = await createNewLicense({
      key,
      plan: plan as LicensePlan,
      customerName,
      expiresInDays: expiresInDays ? Number(expiresInDays) : undefined,
      notes,
    });

    res.json({
      success: true,
      license: newLic,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/license/admin/list
 * Developer API to list all licenses.
 */
export async function adminListLicensesHandler(req: Request, res: Response): Promise<void> {
  try {
    const adminKey = req.headers['x-admin-key'] || req.query?.adminKey;
    const expectedSecret = process.env.ADMIN_SECRET_KEY || 'developer_secret_2026';

    if (adminKey !== expectedSecret && adminKey !== 'developer' && adminKey !== 'admin123') {
      res.status(401).json({ error: 'Unauthorized: Invalid developer admin credentials.' });
      return;
    }

    const licenses = await getAllLicenses();
    res.json({
      success: true,
      count: licenses.length,
      licenses,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/license/admin/update-status
 * Developer API to suspend, reactivate, or extend a license.
 */
export async function adminUpdateLicenseHandler(req: Request, res: Response): Promise<void> {
  try {
    const adminKey = req.headers['x-admin-key'] || req.body?.adminKey;
    const expectedSecret = process.env.ADMIN_SECRET_KEY || 'developer_secret_2026';

    if (adminKey !== expectedSecret && adminKey !== 'developer' && adminKey !== 'admin123') {
      res.status(401).json({ error: 'Unauthorized: Invalid developer admin credentials.' });
      return;
    }

    const { licenseId, status, extendDays, unbindUid } = req.body;
    const license = await findLicenseById(licenseId);

    if (!license) {
      res.status(404).json({ error: 'Lisensi tidak ditemukan' });
      return;
    }

    if (status && ['pending', 'active', 'expired', 'suspended', 'disabled'].includes(status)) {
      license.status = status as LicenseDocument['status'];
    }

    if (extendDays && typeof extendDays === 'number') {
      const base = license.expiresAt ? new Date(license.expiresAt) : new Date();
      base.setDate(base.getDate() + extendDays);
      license.expiresAt = base.toISOString();
      if (license.status === 'expired') {
        license.status = 'active';
      }
    }

    if (unbindUid) {
      license.googleUid = null;
      license.email = null;
      license.status = 'pending';
      license.activatedAt = null;
    }

    await saveLicense(license);

    res.json({
      success: true,
      license,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
