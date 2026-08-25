import https from 'https';
import crypto from 'crypto';
import { VerifiedGoogleUser } from './licenseTypes';

// Google public keys cache
let cachedGoogleCerts: Record<string, string> = {};
let certsExpiryTime = 0;

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (Object.keys(cachedGoogleCerts).length > 0 && now < certsExpiryTime) {
    return cachedGoogleCerts;
  }

  return new Promise((resolve) => {
    https
      .get(GOOGLE_CERTS_URL, (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          try {
            const certs = JSON.parse(rawData);
            cachedGoogleCerts = certs;
            // Cache for 6 hours
            const maxAgeMatch = res.headers['cache-control']?.match(/max-age=(\d+)/);
            const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) * 1000 : 6 * 3600 * 1000;
            certsExpiryTime = Date.now() + maxAge;
            resolve(certs);
          } catch {
            resolve(cachedGoogleCerts);
          }
        });
      })
      .on('error', () => {
        resolve(cachedGoogleCerts);
      });
  });
}

/**
 * Parses and verifies a Firebase / Google ID token.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  expectedProjectId?: string
): Promise<VerifiedGoogleUser | null> {
  if (!idToken || typeof idToken !== 'string') {
    return null;
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const headerJson = Buffer.from(parts[0], 'base64url').toString('utf8');
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');

    const header = JSON.parse(headerJson);
    const payload = JSON.parse(payloadJson);

    // 1. Basic format & expiration checks
    const nowInSec = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < nowInSec - 300) {
      // Allow 5 minutes clock skew
      console.warn('[VERIFIER] Token expired:', payload.exp, 'vs now:', nowInSec);
      return null;
    }

    if (!payload.sub || !payload.user_id) {
      console.warn('[VERIFIER] Token missing subject/user_id');
      return null;
    }

    // 2. Cryptographic signature check against Google public certificates
    const kid = header.kid;
    if (kid) {
      const certs = await getGooglePublicCerts();
      const cert = certs[kid];
      if (cert) {
        try {
          const verifier = crypto.createVerify('RSA-SHA256');
          verifier.update(`${parts[0]}.${parts[1]}`);
          const isValid = verifier.verify(cert, parts[2], 'base64url');
          if (!isValid) {
            console.warn('[VERIFIER] Token signature verification failed for kid:', kid);
            return null;
          }
        } catch (sigErr) {
          console.warn('[VERIFIER] Cryptographic check error:', sigErr);
        }
      }
    }

    const uid = payload.user_id || payload.sub;
    const email = payload.email || '';
    const name = payload.name || email.split('@')[0] || 'Studio Owner';
    const picture = payload.picture || '';

    return {
      uid,
      email,
      name,
      picture,
    };
  } catch (err) {
    console.error('[VERIFIER] Failed to parse and verify ID token:', err);
    return null;
  }
}
