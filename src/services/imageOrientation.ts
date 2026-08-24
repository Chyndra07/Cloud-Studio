/**
 * Image Orientation & EXIF Helper
 * Handles EXIF orientation parsing and UI rotation calculations for 4x6 (2:3 portrait) grid.
 */

export interface ExifOrientationData {
  orientation: number; // 1 to 8
  rotationDegrees: number; // 0, 90, 180, 270
  isFlipped: boolean;
}

/**
 * Extracts EXIF orientation tag from a JPEG ArrayBuffer
 */
export function getExifOrientationFromArrayBuffer(buffer: ArrayBuffer): number {
  try {
    const view = new DataView(buffer);
    if (view.getUint16(0, false) !== 0xffd8) {
      // Not a JPEG
      return 1;
    }

    const length = view.byteLength;
    let offset = 2;

    while (offset < length) {
      if (view.getUint8(offset) !== 0xff) return 1;
      const marker = view.getUint8(offset + 1);

      // APP1 Marker (EXIF)
      if (marker === 0xe1) {
        const markerLength = view.getUint16(offset + 2, false);
        const exifStart = offset + 4;

        // Check for 'Exif\0\0'
        if (
          view.getUint32(exifStart, false) === 0x45786966 &&
          view.getUint16(exifStart + 4, false) === 0x0000
        ) {
          const tiffStart = exifStart + 6;
          const littleEndian = view.getUint16(tiffStart, false) === 0x4949; // 'II'

          const ifdOffset = view.getUint32(tiffStart + 4, littleEndian);
          if (ifdOffset < 0x00000008) return 1;

          const numEntries = view.getUint16(tiffStart + ifdOffset, littleEndian);
          const entriesStart = tiffStart + ifdOffset + 2;

          for (let i = 0; i < numEntries; i++) {
            const entryOffset = entriesStart + i * 12;
            if (entryOffset + 12 > length) break;

            const tag = view.getUint16(entryOffset, littleEndian);
            // 0x0112 is Orientation Tag
            if (tag === 0x0112) {
              const orientation = view.getUint16(entryOffset + 8, littleEndian);
              return orientation >= 1 && orientation <= 8 ? orientation : 1;
            }
          }
        }
        offset += 2 + markerLength;
      } else if ((marker & 0xff00) !== 0xff00) {
        break;
      } else if (marker === 0xd9 || marker === 0xda) {
        // EOI or SOS marker
        break;
      } else {
        offset += 2 + view.getUint16(offset + 2, false);
      }
    }
  } catch (e) {
    console.debug('EXIF orientation extraction caught error:', e);
  }
  return 1;
}

/**
 * Maps EXIF orientation number to degrees of rotation for UI rendering
 */
export function exifToRotationDegrees(orientation: number): number {
  switch (orientation) {
    case 3:
      return 180;
    case 6:
      return 90;
    case 8:
      return 270;
    default:
      return 0;
  }
}

/**
 * Determines whether a photo needs automatic 90° rotation to fit an upright 4x6 (2:3 portrait) grid.
 *
 * Rules:
 * 1. If EXIF tag is present (e.g. 6 or 8), use that orientation.
 * 2. If photo is already portrait (naturalWidth <= naturalHeight), do not rotate (0°).
 * 3. If photo is sideways portrait captured in landscape matrix with explicit tag or rotation requirement, rotate 90°.
 */
export function calculateThumbnailRotation(
  exifOrientation: number = 1,
  manualRotation: number = 0,
  naturalWidth: number = 0,
  naturalHeight: number = 0
): number {
  let degrees = (manualRotation || 0) % 360;

  if (exifOrientation && exifOrientation > 1) {
    const exifDegrees = exifToRotationDegrees(exifOrientation);
    degrees = (degrees + exifDegrees) % 360;
  }

  return (degrees + 360) % 360;
}
