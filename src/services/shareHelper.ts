import { Album } from '../types';
import { getPublicGalleryUrl } from '../config/appConfig';

export interface AlbumShareInfo {
  text: string;
  hasPin: boolean;
  notificationMessage: string;
  daysLeft: number;
  status: 'Aktif' | 'Segera Berakhir' | 'Kedaluwarsa';
  masaAktifText: string;
  berlakuHinggaText?: string;
}

/**
 * Format date to standard readable Indonesian date format (e.g. "30 Oktober 2027")
 */
export function formatIndonesianDate(dateString?: string): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

/**
 * Generates the standardized Album Share Information string with safe null guards:
 * 
 * A. Jika Album Menggunakan PIN:
 * Nama Album: coba 1
 * Nama Pelanggan: nanda
 * Link Galeri: https://domain.com/#/gallery/GFQ-N7D97B
 * PIN Galeri: 1234
 * Masa Aktif: 365 Hari
 * Status: Aktif
 * Berlaku Hingga: 30 Oktober 2027
 * 
 * B. Jika Album Tidak Menggunakan PIN:
 * Nama Album: coba 1
 * Nama Pelanggan: nanda
 * Link Galeri: https://domain.com/#/gallery/GFQ-N7D97B
 * Masa Aktif: 365 Hari
 * Status: Aktif
 * Berlaku Hingga: 30 Oktober 2027
 */
export function formatAlbumShareInfo(album?: Album | null): AlbumShareInfo {
  if (!album) {
    return {
      text: '',
      hasPin: false,
      notificationMessage: 'Data album tidak valid.',
      daysLeft: 0,
      status: 'Aktif',
      masaAktifText: 'Tidak Terbatas',
    };
  }

  const cleanGalleryId = (album.galleryId || '').trim();
  const galleryUrl = cleanGalleryId ? getPublicGalleryUrl(cleanGalleryId) : '';
  const hasPin = Boolean(album.isPinEnabled && album.pin && album.pin.trim().length > 0);

  // Expiration & Active Period calculations
  let daysLeft = 0;
  let status: 'Aktif' | 'Segera Berakhir' | 'Kedaluwarsa' = 'Aktif';
  let masaAktifText = 'Tidak Terbatas';
  let berlakuHinggaText = '';

  if (album.expirationDate) {
    const expTime = new Date(album.expirationDate).getTime();
    if (!isNaN(expTime)) {
      const diff = expTime - Date.now();
      daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
      berlakuHinggaText = formatIndonesianDate(album.expirationDate);

      if (diff <= 0) {
        status = 'Kedaluwarsa';
        daysLeft = 0;
        masaAktifText = '0 Hari';
      } else if (diff <= 3 * 24 * 60 * 60 * 1000) {
        status = 'Segera Berakhir';
        masaAktifText = `${daysLeft} Hari`;
      } else {
        status = 'Aktif';
        masaAktifText = `${daysLeft} Hari`;
      }
    }
  }

  // Construct lines adhering strictly to specification
  const lines: string[] = [
    `Nama Album: ${album.albumName || '-'}`,
    `Nama Pelanggan: ${album.clientName || '-'}`,
    `Link Galeri: ${galleryUrl}`,
  ];

  if (hasPin) {
    lines.push(`PIN Galeri: ${album.pin.trim()}`);
  }

  lines.push(`Masa Aktif: ${masaAktifText}`);
  lines.push(`Status: ${status}`);

  if (berlakuHinggaText) {
    lines.push(`Berlaku Hingga: ${berlakuHinggaText}`);
  }

  const text = lines.join('\n');
  const notificationMessage = hasPin
    ? 'Informasi galeri berhasil disalin, termasuk PIN dan masa aktif album.'
    : 'Link dan informasi masa aktif galeri berhasil disalin.';

  return {
    text,
    hasPin,
    notificationMessage,
    daysLeft,
    status,
    masaAktifText,
    berlakuHinggaText,
  };
}

/**
 * Copies the standardized Album Share Information to clipboard with robust 2-tier fallback.
 */
export async function copyAlbumShareInfo(album?: Album | null): Promise<{
  success: boolean;
  hasPin: boolean;
  notificationMessage: string;
  text: string;
}> {
  if (!album) {
    return {
      success: false,
      hasPin: false,
      notificationMessage: 'Data album tidak tersedia.',
      text: '',
    };
  }

  const shareInfo = formatAlbumShareInfo(album);
  let copied = false;

  // 1. Try modern navigator.clipboard.writeText
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(shareInfo.text);
      copied = true;
    } catch (clipErr) {
      console.warn('[SHARE_HELPER] navigator.clipboard.writeText failed, attempting execCommand fallback:', clipErr);
    }
  }

  // 2. Fallback to execCommand if clipboard API was unavailable or threw error
  if (!copied && typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = shareInfo.text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (successful) {
        copied = true;
      }
    } catch (fallbackErr) {
      console.warn('[SHARE_HELPER] execCommand fallback also failed:', fallbackErr);
    }
  }

  return {
    success: copied,
    hasPin: shareInfo.hasPin,
    notificationMessage: copied
      ? shareInfo.notificationMessage
      : 'Gagal menyalin otomatis ke clipboard. Tautan: ' + (shareInfo.text.split('\n')[2] || ''),
    text: shareInfo.text,
  };
}
