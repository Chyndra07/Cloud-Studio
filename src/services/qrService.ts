import QRCode from 'qrcode';
import { getPublicGalleryUrl, isAiStudioHost } from '../config/appConfig';

export interface QRCardOptions {
  galleryId: string;
  albumName: string;
  clientName: string;
  pin?: string;
  studioName?: string;
  brandColor?: string;
  logoUrl?: string;
}

/**
 * Generates a clean QR code Data URL for a given Gallery ID
 * Guaranteed to point to the exact same URL as getPublicGalleryUrl(galleryId)
 */
export async function generateGalleryQRDataUrl(galleryId: string): Promise<string> {
  const url = getPublicGalleryUrl(galleryId);
  console.log('[QR] Generating QR for payload URL:', url);

  // Anti-AI-Studio strict validation
  if (url.includes('aistudio.google.com') || url.includes('googleusercontent.com')) {
    console.error('[QR_SECURITY_ERROR] Rejected attempt to encode Google AI Studio editor domain in QR code');
    throw new Error('Domain Google AI Studio tidak boleh digunakan sebagai URL galeri pelanggan.');
  }

  try {
    return await QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    });
  } catch (error: any) {
    console.error('[QR] QR Generation error:', error);
    throw new Error(error?.message || 'Gagal membuat QR Code.');
  }
}

/**
 * Generates an SVG string of the QR Code
 */
export async function generateGalleryQRSvg(galleryId: string): Promise<string> {
  const url = getPublicGalleryUrl(galleryId);

  if (url.includes('aistudio.google.com') || url.includes('googleusercontent.com')) {
    throw new Error('Domain Google AI Studio tidak boleh digunakan sebagai URL galeri pelanggan.');
  }

  return QRCode.toString(url, {
    type: 'svg',
    margin: 2,
    errorCorrectionLevel: 'H',
  });
}

/**
 * Generates a high-resolution printable Studio Branding Card with QR Code
 */
export async function generateBrandedQRCard(options: QRCardOptions): Promise<string> {
  const { galleryId, albumName, clientName, pin, studioName = 'Studio Foto', brandColor = '#2563eb', logoUrl } = options;
  const qrDataUrl = await generateGalleryQRDataUrl(galleryId);
  const publicUrl = getPublicGalleryUrl(galleryId);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context tidak tersedia.');

  // Dimensions for high-res printable card (1200 x 1600 px)
  canvas.width = 1200;
  canvas.height = 1600;

  // 1. Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Top Header Banner
  ctx.fillStyle = brandColor;
  ctx.fillRect(0, 0, canvas.width, 240);

  // 3. Studio Name in Header
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(studioName.toUpperCase(), canvas.width / 2, 140);

  ctx.font = '30px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillText('GALERI FOTO DIGITAL RESMI', canvas.width / 2, 190);

  // 4. Album & Client Details
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 56px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(albumName, canvas.width / 2, 340);

  ctx.fillStyle = '#64748b';
  ctx.font = '36px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`Pelanggan: ${clientName}`, canvas.width / 2, 400);

  // 5. Draw QR Code in Center
  const qrImg = new Image();
  await new Promise<void>((resolve, reject) => {
    qrImg.onload = () => resolve();
    qrImg.onerror = reject;
    qrImg.src = qrDataUrl;
  });

  const qrSize = 600;
  const qrX = (canvas.width - qrSize) / 2;
  const qrY = 460;

  // QR Frame & Shadow
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(qrX - 24, qrY - 24, qrSize + 48, qrSize + 48);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 4;
  ctx.strokeRect(qrX - 24, qrY - 24, qrSize + 48, qrSize + 48);

  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  // 6. Gallery ID Pill
  const pillY = 1140;
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.roundRect(canvas.width / 2 - 260, pillY - 40, 520, 80, 40);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 38px monospace';
  ctx.fillText(`ID: ${galleryId}`, canvas.width / 2, pillY + 12);

  // 7. PIN info if enabled
  if (pin) {
    ctx.fillStyle = '#b45309';
    ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`KODE PIN: ${pin}`, canvas.width / 2, 1260);
  }

  // 8. Instructions
  ctx.fillStyle = '#334155';
  ctx.font = '32px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Arahkan kamera smartphone Anda ke QR Code di atas', canvas.width / 2, 1340);
  ctx.fillStyle = '#64748b';
  ctx.font = '26px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('untuk melihat, memilih foto favorit, dan mengunduh foto asli berkualitas tinggi.', canvas.width / 2, 1390);

  // 9. Footer URL
  ctx.fillStyle = '#94a3b8';
  ctx.font = '24px monospace';
  ctx.fillText(publicUrl.length > 60 ? publicUrl.slice(0, 57) + '...' : publicUrl, canvas.width / 2, 1510);

  return canvas.toDataURL('image/png');
}
