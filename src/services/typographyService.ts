import { FontFamilyType, FontSizeScale, StudioTypography } from '../types';

export interface FontFamilyOption {
  id: FontFamilyType;
  name: string;
  category: string;
  description: string;
  fontStack: string;
  sampleText: string;
}

export interface FontSizeOption {
  id: FontSizeScale;
  label: string;
  px: number;
  scale: string;
  description: string;
}

export const DEFAULT_TYPOGRAPHY: StudioTypography = {
  fontFamily: 'Inter',
  fontSize: 'm',
};

export const FONT_FAMILY_OPTIONS: FontFamilyOption[] = [
  {
    id: 'Inter',
    name: 'Inter',
    category: 'Sans-Serif Modern (Default)',
    description: 'Tipografi UI standar industri: jernih, netral, sangat mudah dibaca di berbagai resolusi layar.',
    fontStack: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    sampleText: 'Galeri Foto Digital & Cloud Studio',
  },
  {
    id: 'Plus Jakarta Sans',
    name: 'Plus Jakarta Sans',
    category: 'Geometric Editorial',
    description: 'Karakter modern dan dinamis dengan sentuhan geometris yang elegan dan bersahabat.',
    fontStack: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    sampleText: 'Modern Premium Photography Studio',
  },
  {
    id: 'SF Pro Display',
    name: 'SF Pro Display',
    category: 'Apple Premium Aesthetic',
    description: 'Tipografi khas ekosistem Apple: presisi tinggi, proporsional, dan berkelas profesional.',
    fontStack: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro', 'Helvetica Neue', sans-serif",
    sampleText: 'Your Story, Our Lens Professional',
  },
  {
    id: 'Poppins',
    name: 'Poppins',
    category: 'Contemporary Rounded',
    description: 'Bentuk huruf membulat dan hangat, memberikan nuansa ramah, modern, dan ekspresif.',
    fontStack: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif",
    sampleText: 'Dokumentasi Momen Bahagia & Kenangan',
  },
  {
    id: 'Roboto',
    name: 'Roboto',
    category: 'Neo-Grotesque Standard',
    description: 'Format klasik Google dengan ritme baca seimbang dan keterbacaan tinggi di segala kondisi.',
    fontStack: "'Roboto', -apple-system, BlinkMacSystemFont, sans-serif",
    sampleText: 'Official Digital Album Portfolio',
  },
];

export const FONT_SIZE_OPTIONS: FontSizeOption[] = [
  {
    id: 'xs',
    label: 'XS: 12px',
    px: 12,
    scale: '0.75x',
    description: 'Tampilan kompak & padat, cocok untuk melihat banyak data sekaligus.',
  },
  {
    id: 's',
    label: 'S: 14px',
    px: 14,
    scale: '0.875x',
    description: 'Ukuran ramping dengan keterbacaan tinggi untuk monitor beresolusi standar.',
  },
  {
    id: 'm',
    label: 'M: 16px',
    px: 16,
    scale: '1.0x (Default)',
    description: 'Standar ergonomis ideal untuk kenyamanan mata di desktop dan mobile.',
  },
  {
    id: 'l',
    label: 'L: 18px',
    px: 18,
    scale: '1.125x',
    description: 'Teks lebih besar dan tegas, memudahkan navigasi pelanggan.',
  },
  {
    id: 'xl',
    label: 'XL: 20px',
    px: 20,
    scale: '1.25x',
    description: 'Ukuran besar dengan penekanan visual yang kuat untuk layar besar.',
  },
  {
    id: 'xxl',
    label: 'XXL: 22px',
    px: 22,
    scale: '1.375x',
    description: 'Ekstra besar, nyaman untuk presentasi studio atau tampilan jarak jauh.',
  },
  {
    id: 'xxxl',
    label: 'XXXL: 24px',
    px: 24,
    scale: '1.5x',
    description: 'Ukuran maksimal dengan keterbacaan prima untuk semua audiens.',
  },
];

const TYPOGRAPHY_CACHE_KEY = 'gfq_active_typography';

/**
 * Gets currently active typography from cache or fallback to default
 */
export function getActiveTypography(): StudioTypography {
  try {
    const raw = localStorage.getItem(TYPOGRAPHY_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.fontFamily && parsed.fontSize) {
        return parsed as StudioTypography;
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_TYPOGRAPHY;
}

/**
 * Resolves font stack string by font family name
 */
export function getFontStack(family: FontFamilyType): string {
  const match = FONT_FAMILY_OPTIONS.find((f) => f.id === family);
  return match ? match.fontStack : FONT_FAMILY_OPTIONS[0].fontStack;
}

/**
 * Resolves pixel size by font size scale key
 */
export function getFontSizePx(size: FontSizeScale): number {
  const match = FONT_SIZE_OPTIONS.find((s) => s.id === size);
  return match ? match.px : 16;
}

/**
 * Applies typography to root document and body with smooth CSS transition
 */
export function applyTypography(settings?: Partial<StudioTypography> | null): StudioTypography {
  if (typeof document === 'undefined') {
    return DEFAULT_TYPOGRAPHY;
  }

  const activeFamily: FontFamilyType = settings?.fontFamily || 'Inter';
  const activeSize: FontSizeScale = settings?.fontSize || 'm';

  const fontStack = getFontStack(activeFamily);
  const px = getFontSizePx(activeSize);

  const root = document.documentElement;
  const body = document.body;

  // Apply CSS Variables
  root.style.setProperty('--app-font-family', fontStack);
  root.style.setProperty('--app-font-size-base', `${px}px`);
  root.style.setProperty('font-size', `${px}px`);
  root.setAttribute('data-font', activeFamily);
  root.setAttribute('data-font-size', activeSize);

  if (body) {
    body.style.fontFamily = fontStack;
  }

  const result: StudioTypography = {
    fontFamily: activeFamily,
    fontSize: activeSize,
  };

  try {
    localStorage.setItem(TYPOGRAPHY_CACHE_KEY, JSON.stringify(result));
  } catch {
    // ignore
  }

  return result;
}

/**
 * Resets typography to system default (Inter 16px)
 */
export function resetTypography(): StudioTypography {
  return applyTypography(DEFAULT_TYPOGRAPHY);
}
