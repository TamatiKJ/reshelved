import { addDoc, collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CATEGORIES } from '../types';

export type ListingCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  active: boolean;
  createdAt?: number;
  updatedAt?: number;
  createdBy?: string;
};

export const LISTING_CATEGORIES_COLLECTION = 'categories';

export const slugifyCategory = (value: string) => value
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 80);

export const fallbackListingCategories: ListingCategory[] = CATEGORIES.map((name, index) => ({
  id: slugifyCategory(name) || `category-${index}`,
  name,
  slug: slugifyCategory(name) || `category-${index}`,
  sortOrder: index + 1,
  active: true
}));

const normalizeCategory = (id: string, data: Record<string, any>, index: number): ListingCategory | null => {
  const name = String(data.name || '').trim();
  if (!name) return null;
  return {
    id,
    name,
    slug: String(data.slug || slugifyCategory(name)).trim(),
    description: String(data.description || '').trim(),
    icon: String(data.icon || '').trim(),
    sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : index + 1,
    active: data.active !== false,
    createdAt: Number(data.createdAt || 0) || undefined,
    updatedAt: Number(data.updatedAt || 0) || undefined,
    createdBy: String(data.createdBy || '').trim() || undefined
  };
};

export const getListingCategories = async ({ includeInactive = false }: { includeInactive?: boolean } = {}) => {
  const snapshot = await getDocs(collection(db, LISTING_CATEGORIES_COLLECTION));
  const items = snapshot.docs
    .map((item, index) => normalizeCategory(item.id, item.data(), index))
    .filter(Boolean) as ListingCategory[];

  const visibleItems = includeInactive ? items : items.filter((item) => item.active);
  return visibleItems.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
};

export const getActiveListingCategoriesWithFallback = async () => {
  try {
    const categories = await getListingCategories({ includeInactive: false });
    return categories.length > 0 ? categories : fallbackListingCategories;
  } catch {
    return fallbackListingCategories;
  }
};

export const createListingCategory = async ({
  name,
  description = '',
  icon = '',
  sortOrder,
  createdBy = ''
}: {
  name: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
  createdBy?: string;
}) => {
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Category name is required.');

  const now = Date.now();
  const payload = {
    name: cleanName,
    slug: slugifyCategory(cleanName),
    description: description.trim(),
    icon: icon.trim(),
    sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : now,
    active: true,
    createdAt: now,
    updatedAt: now,
    createdBy
  };

  const ref = await addDoc(collection(db, LISTING_CATEGORIES_COLLECTION), payload);
  return { id: ref.id, ...payload } as ListingCategory;
};

export const updateListingCategory = async (categoryId: string, updates: Partial<ListingCategory>) => {
  const payload: Record<string, unknown> = { ...updates, updatedAt: Date.now() };
  if (typeof updates.name === 'string') {
    payload.name = updates.name.trim();
    payload.slug = slugifyCategory(updates.name);
  }
  await setDoc(doc(db, LISTING_CATEGORIES_COLLECTION, categoryId), payload, { merge: true });
};

export const seedDefaultListingCategories = async (createdBy = '') => {
  const existing = await getListingCategories({ includeInactive: true }).catch(() => []);
  const existingSlugs = new Set(existing.map((item) => item.slug));
  const now = Date.now();

  const writes = fallbackListingCategories
    .filter((item) => !existingSlugs.has(item.slug))
    .map((item) => addDoc(collection(db, LISTING_CATEGORIES_COLLECTION), {
      name: item.name,
      slug: item.slug,
      description: item.description || '',
      icon: item.icon || '',
      sortOrder: item.sortOrder,
      active: true,
      createdAt: now,
      updatedAt: now,
      createdBy
    }));

  await Promise.all(writes);
  return writes.length;
};
