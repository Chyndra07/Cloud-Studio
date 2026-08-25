import fs from 'fs';
import path from 'path';
import { PublicGalleryData, ClientSelection } from '../../src/types';

const DATA_DIR = path.join(process.cwd(), '.data');
const GALLERIES_FILE = path.join(DATA_DIR, 'public_galleries.json');
const SELECTIONS_FILE = path.join(DATA_DIR, 'client_selections.json');

// Memory store for fast lookup
const galleryStore: Map<string, PublicGalleryData> = new Map();
const selectionStore: Map<string, ClientSelection> = new Map();

// Initialize disk storage
function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('[SERVER_STORAGE] Cannot create data dir:', err);
  }
}

function loadFromDisk(): void {
  ensureDataDir();
  try {
    if (fs.existsSync(GALLERIES_FILE)) {
      const raw = fs.readFileSync(GALLERIES_FILE, 'utf-8');
      const list: PublicGalleryData[] = JSON.parse(raw);
      list.forEach((g) => {
        if (g && g.galleryId) {
          galleryStore.set(g.galleryId.toUpperCase().trim(), g);
        }
      });
      console.log(`[SERVER_STORAGE] Loaded ${galleryStore.size} galleries from disk`);
    }
  } catch (err) {
    console.warn('[SERVER_STORAGE] Error loading galleries file:', err);
  }

  try {
    if (fs.existsSync(SELECTIONS_FILE)) {
      const raw = fs.readFileSync(SELECTIONS_FILE, 'utf-8');
      const list: ClientSelection[] = JSON.parse(raw);
      list.forEach((s) => {
        if (s && s.galleryId) {
          selectionStore.set(s.galleryId.toUpperCase().trim(), s);
        }
      });
    }
  } catch (err) {
    console.warn('[SERVER_STORAGE] Error loading selections file:', err);
  }
}

function saveToDisk(): void {
  ensureDataDir();
  try {
    const galleryList = Array.from(galleryStore.values());
    fs.writeFileSync(GALLERIES_FILE, JSON.stringify(galleryList, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[SERVER_STORAGE] Failed to save galleries to disk:', err);
  }

  try {
    const selectionList = Array.from(selectionStore.values());
    fs.writeFileSync(SELECTIONS_FILE, JSON.stringify(selectionList, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[SERVER_STORAGE] Failed to save selections to disk:', err);
  }
}

// Initial load
loadFromDisk();

export function getPublicGalleryFromStore(galleryId: string): PublicGalleryData | null {
  if (!galleryId) return null;
  const cleanId = galleryId.toUpperCase().trim();
  const data = galleryStore.get(cleanId);
  if (!data) return null;

  // Recompute isExpired
  if (data.expirationDate) {
    data.isExpired = new Date(data.expirationDate).getTime() < Date.now();
    if (data.isExpired) {
      data.status = 'expired';
    }
  }
  return data;
}

export function savePublicGalleryToStore(data: PublicGalleryData): void {
  if (!data || !data.galleryId) return;
  const cleanId = data.galleryId.toUpperCase().trim();
  data.galleryId = cleanId;
  data.updatedAt = new Date().toISOString();
  galleryStore.set(cleanId, data);
  saveToDisk();
}

export function getClientSelectionFromStore(galleryId: string): ClientSelection | null {
  if (!galleryId) return null;
  const cleanId = galleryId.toUpperCase().trim();
  return selectionStore.get(cleanId) || null;
}

export function saveClientSelectionToStore(selection: ClientSelection): void {
  if (!selection || !selection.galleryId) return;
  const cleanId = selection.galleryId.toUpperCase().trim();
  selection.galleryId = cleanId;
  selection.updatedAt = new Date().toISOString();
  selectionStore.set(cleanId, selection);
  saveToDisk();
}
