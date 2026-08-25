import { Request, Response } from 'express';
import {
  getPublicGalleryFromStore,
  savePublicGalleryToStore,
  getClientSelectionFromStore,
  saveClientSelectionToStore,
} from './galleryRepository';
import { PublicGalleryData, ClientSelection } from '../../src/types';

/**
 * GET /api/gallery/:galleryId
 * Public endpoint: Returns metadata for a public gallery without authentication.
 */
export async function getPublicGalleryHandler(req: Request, res: Response): Promise<void> {
  try {
    const { galleryId } = req.params;
    if (!galleryId) {
      res.status(400).json({
        success: false,
        error: 'Gallery ID is required.',
      });
      return;
    }

    const cleanId = galleryId.toUpperCase().trim();
    console.log(`[API_GALLERY] Fetching gallery for ID: ${cleanId}`);

    const gallery = getPublicGalleryFromStore(cleanId);
    if (!gallery) {
      res.status(404).json({
        success: false,
        error: `Galeri dengan ID "${cleanId}" tidak ditemukan atau belum dipublikasikan.`,
      });
      return;
    }

    res.json({
      success: true,
      data: gallery,
    });
  } catch (err: any) {
    console.error('[API_GALLERY] Error fetching gallery:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error while loading gallery.',
    });
  }
}

/**
 * POST /api/gallery/sync
 * Endpoint to sync / store public gallery metadata from frontend / studio.
 */
export async function syncPublicGalleryHandler(req: Request, res: Response): Promise<void> {
  try {
    const data: PublicGalleryData = req.body;
    if (!data || !data.galleryId || !data.albumName) {
      res.status(400).json({
        success: false,
        error: 'Invalid public gallery payload: galleryId and albumName are required.',
      });
      return;
    }

    const cleanId = data.galleryId.toUpperCase().trim();
    data.galleryId = cleanId;

    savePublicGalleryToStore(data);
    console.log(`[API_GALLERY] Synced gallery ID: ${cleanId} ("${data.albumName}")`);

    res.json({
      success: true,
      message: 'Gallery synced successfully.',
      galleryId: cleanId,
    });
  } catch (err: any) {
    console.error('[API_GALLERY] Error syncing gallery:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error while syncing gallery.',
    });
  }
}

/**
 * GET /api/gallery/selection/:galleryId
 * Public endpoint: Returns client favorite picks and notes.
 */
export async function getClientSelectionHandler(req: Request, res: Response): Promise<void> {
  try {
    const { galleryId } = req.params;
    if (!galleryId) {
      res.status(400).json({ success: false, error: 'Gallery ID is required.' });
      return;
    }

    const cleanId = galleryId.toUpperCase().trim();
    const selection = getClientSelectionFromStore(cleanId);

    res.json({
      success: true,
      data: selection || {
        galleryId: cleanId,
        selectedPhotoIds: [],
        notes: {},
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('[API_GALLERY] Error getting selection:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve client selection.' });
  }
}

/**
 * POST /api/gallery/selection
 * Public endpoint: Saves client favorite picks and notes.
 */
export async function saveClientSelectionHandler(req: Request, res: Response): Promise<void> {
  try {
    const selection: ClientSelection = req.body;
    if (!selection || !selection.galleryId) {
      res.status(400).json({ success: false, error: 'Invalid client selection payload.' });
      return;
    }

    const cleanId = selection.galleryId.toUpperCase().trim();
    selection.galleryId = cleanId;

    saveClientSelectionToStore(selection);
    console.log(`[API_GALLERY] Saved selection for gallery ID: ${cleanId} (${selection.selectedPhotoIds?.length || 0} items)`);

    res.json({
      success: true,
      message: 'Client selection saved successfully.',
    });
  } catch (err: any) {
    console.error('[API_GALLERY] Error saving selection:', err);
    res.status(500).json({ success: false, error: 'Failed to save client selection.' });
  }
}
