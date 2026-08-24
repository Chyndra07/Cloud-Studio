import jsQR from 'jsqr';

export interface QRVerificationResult {
  expectedUrl: string;
  decodedUrl: string | null;
  isMatch: boolean;
  error?: string;
}

/**
 * Decodes a QR code image from a Data URL (base64 PNG) and returns the encoded string.
 */
export async function decodeQrFromDataUrl(dataUrl: string): Promise<string | null> {
  if (typeof window === 'undefined' || !dataUrl) return null;

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && typeof code.data === 'string') {
            resolve(code.data.trim());
          } else {
            resolve(null);
          }
        } catch (err: any) {
          console.error('[QR Verification] Canvas extraction error:', err);
          resolve(null);
        }
      };
      img.onerror = (err) => {
        console.error('[QR Verification] Image loading failed:', err);
        resolve(null);
      };
      img.src = dataUrl;
    } catch (err: any) {
      console.error('[QR Verification] Unexpected error:', err);
      resolve(null);
    }
  });
}

/**
 * Verifies that the generated QR dataURL payload strictly matches the expected URL character-by-character.
 */
export async function verifyQRCodePayload(dataUrl: string, expectedUrl: string): Promise<QRVerificationResult> {
  const cleanExpected = (expectedUrl || '').trim();
  const decoded = await decodeQrFromDataUrl(dataUrl);

  const isMatch = !!decoded && decoded === cleanExpected;

  if (!isMatch) {
    console.error('[CRITICAL QR PAYLOAD MISMATCH]', {
      expectedUrl: cleanExpected,
      decodedUrl: decoded,
      match: isMatch,
    });
  } else {
    console.log('[QR PAYLOAD VERIFIED 100% MATCH]', {
      expectedUrl: cleanExpected,
      decodedUrl: decoded,
      match: true,
    });
  }

  return {
    expectedUrl: cleanExpected,
    decodedUrl: decoded,
    isMatch,
    error: !decoded
      ? 'Gagal membaca isi QR Code secara otomatis.'
      : !isMatch
      ? `Isi QR Code (${decoded}) tidak sesuai dengan URL yang diharapkan (${cleanExpected}).`
      : undefined,
  };
}
