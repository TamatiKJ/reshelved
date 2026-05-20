import { addDoc, collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { KENYAN_CITIES } from '../types';

export type LocationOption = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  active: boolean;
  createdAt?: number;
  updatedAt?: number;
  createdBy?: string;
};

export const LOCATIONS_COLLECTION = 'locations';

export const slugifyLocation = (value: string) => value
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 80);

export const fallbackLocations: LocationOption[] = KENYAN_CITIES.map((name, index) => ({
  id: slugifyLocation(name) || `location-${index}`,
  name,
  slug: slugifyLocation(name) || `location-${index}`,
  sortOrder: index + 1,
  active: true
}));

const normalizeLocation = (id: string, data: Record<string, any>, index: number): LocationOption | null => {
  const name = String(data.name || '').trim();
  if (!name) return null;

  return {
    id,
    name,
    slug: String(data.slug || slugifyLocation(name)).trim(),
    sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : index + 1,
    active: data.active !== false,
    createdAt: Number(data.createdAt || 0) || undefined,
    updatedAt: Number(data.updatedAt || 0) || undefined,
    createdBy: String(data.createdBy || '').trim() || undefined
  };
};

export const getLocations = async ({ includeInactive = false }: { includeInactive?: boolean } = {}) => {
  const snapshot = await getDocs(collection(db, LOCATIONS_COLLECTION));
  const items = snapshot.docs
    .map((item, index) => normalizeLocation(item.id, item.data(), index))
    .filter(Boolean) as LocationOption[];

  const visibleItems = includeInactive ? items : items.filter((item) => item.active);
  return visibleItems.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
};

export const getActiveLocationsWithFallback = async () => {
  try {
    const locations = await getLocations({ includeInactive: false });
    return locations.length > 0 ? locations : fallbackLocations;
  } catch {
    return fallbackLocations;
  }
};

export const createLocation = async ({
  name,
  sortOrder,
  createdBy = ''
}: {
  name: string;
  sortOrder?: number;
  createdBy?: string;
}) => {
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Location name is required.');

  const now = Date.now();
  const payload = {
    name: cleanName,
    slug: slugifyLocation(cleanName),
    sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : now,
    active: true,
    createdAt: now,
    updatedAt: now,
    createdBy
  };

  const ref = await addDoc(collection(db, LOCATIONS_COLLECTION), payload);
  return { id: ref.id, ...payload } as LocationOption;
};

export const updateLocation = async (locationId: string, updates: Partial<LocationOption>) => {
  const payload: Record<string, unknown> = { ...updates, updatedAt: Date.now() };
  if (typeof updates.name === 'string') {
    payload.name = updates.name.trim();
    payload.slug = slugifyLocation(updates.name);
  }
  await setDoc(doc(db, LOCATIONS_COLLECTION, locationId), payload, { merge: true });
};

export const seedDefaultLocations = async (createdBy = '') => {
  const existing = await getLocations({ includeInactive: true }).catch(() => []);
  const existingSlugs = new Set(existing.map((item) => item.slug));
  const now = Date.now();

  const writes = fallbackLocations
    .filter((item) => !existingSlugs.has(item.slug))
    .map((item) => addDoc(collection(db, LOCATIONS_COLLECTION), {
      name: item.name,
      slug: item.slug,
      sortOrder: item.sortOrder,
      active: true,
      createdAt: now,
      updatedAt: now,
      createdBy
    }));

  await Promise.all(writes);
  return writes.length;
};
