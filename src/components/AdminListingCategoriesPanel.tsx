import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  createListingCategory,
  getListingCategories,
  updateListingCategory,
  type ListingCategory
} from '../services/listingCategories';

const inputClass = 'w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10 disabled:bg-stone-50';
const labelClass = 'mb-1.5 block text-sm font-bold text-stone-950';

type DraftCategory = Pick<ListingCategory, 'name' | 'description' | 'icon' | 'sortOrder' | 'active'>;

const AdminListingCategoriesPanel: React.FC = () => {
  const { currentUser } = useAuth();
  const [categories, setCategories] = useState<ListingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<DraftCategory>({ name: '', description: '', icon: '', sortOrder: 1, active: true });

  const nextSortOrder = useMemo(() => {
    if (categories.length === 0) return 1;
    return Math.max(...categories.map((item) => Number(item.sortOrder || 0))) + 1;
  }, [categories]);

  const showMessage = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 2800);
  };

  const loadCategories = async () => {
    setLoading(true);
    try {
      const items = await getListingCategories({ includeInactive: true });
      setCategories(items);
    } catch (error) {
      console.error('Could not load listing categories:', error);
      showMessage('Could not load categories. Check Firestore rules.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { setDraft((current) => ({ ...current, sortOrder: nextSortOrder })); }, [nextSortOrder]);

  const addCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || !currentUser) return;
    setSavingId('new');
    try {
      const created = await createListingCategory({
        name: draft.name,
        description: draft.description,
        icon: draft.icon,
        sortOrder: draft.sortOrder,
        createdBy: currentUser.uid
      });
      setCategories((current) => [...current, created].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
      setDraft({ name: '', description: '', icon: '', sortOrder: nextSortOrder + 1, active: true });
      showMessage('Category created.');
    } catch (error: any) {
      showMessage(error?.message || 'Category could not be created.');
    } finally {
      setSavingId(null);
    }
  };

  const updateLocalCategory = (id: string, updates: Partial<ListingCategory>) => {
    setCategories((current) => current.map((item) => item.id === id ? { ...item, ...updates } : item));
  };

  const saveCategory = async (category: ListingCategory) => {
    if (!category.name.trim()) return showMessage('Category name cannot be empty.');
    setSavingId(category.id);
    try {
      await updateListingCategory(category.id, {
        name: category.name,
        description: category.description || '',
        icon: category.icon || '',
        sortOrder: Number(category.sortOrder) || 1,
        active: category.active !== false
      });
      setCategories((current) => [...current].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
      showMessage('Category saved.');
    } catch (error) {
      console.error('Could not save listing category:', error);
      showMessage('Category could not be saved. Check Firestore rules.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="mb-5">
        <h3 className="text-[15px] font-bold text-stone-950">Listing Categories</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Manage the categories used on Create Listing, Edit Listing, and Browse filters. Deactivate categories instead of deleting them so old listings remain stable.</p>
      </div>

      {message && <div className="mb-5 rounded-2xl border border-[#1665CC]/20 bg-[#1665CC]/5 px-4 py-3 text-sm font-bold text-[#1665CC]">{message}</div>}

      <form onSubmit={addCategory} className="mb-6 rounded-2xl border border-stone-200 bg-stone-50 p-5">
        <h4 className="text-sm font-bold text-stone-950">Add category</h4>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr_0.8fr_120px]">
          <label><span className={labelClass}>Name</span><input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className={inputClass} placeholder="e.g. Academic" /></label>
          <label><span className={labelClass}>Description</span><input value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} className={inputClass} placeholder="Short admin note" /></label>
          <label><span className={labelClass}>Icon class</span><input value={draft.icon} onChange={(event) => setDraft((current) => ({ ...current, icon: event.target.value }))} className={inputClass} placeholder="las la-book" /></label>
          <label><span className={labelClass}>Sort</span><input type="number" value={draft.sortOrder} onChange={(event) => setDraft((current) => ({ ...current, sortOrder: Number(event.target.value) || 1 }))} className={inputClass} /></label>
        </div>
        <button type="submit" disabled={!draft.name.trim() || savingId === 'new'} className="mt-4 cursor-pointer rounded-xl bg-[#1665CC] px-5 py-3 text-sm font-bold text-white hover:bg-[#1254a9] disabled:cursor-not-allowed disabled:opacity-50">{savingId === 'new' ? 'Adding...' : 'Add category'}</button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-stone-200">
        <div className="border-b border-stone-100 bg-white px-5 py-4">
          <h4 className="text-sm font-bold text-stone-950">Current categories</h4>
        </div>
        {loading ? <div className="p-8 text-center text-sm text-stone-500">Loading categories...</div> : categories.length === 0 ? <div className="p-8 text-center text-sm text-stone-500">No categories yet. Add your first category above.</div> : <div className="divide-y divide-stone-100 bg-white">
          {categories.map((category) => (
            <div key={category.id} className="grid gap-4 p-5 lg:grid-cols-[1.2fr_1fr_0.8fr_110px_120px_110px] lg:items-end">
              <label><span className={labelClass}>Name</span><input value={category.name} onChange={(event) => updateLocalCategory(category.id, { name: event.target.value })} className={inputClass} /></label>
              <label><span className={labelClass}>Description</span><input value={category.description || ''} onChange={(event) => updateLocalCategory(category.id, { description: event.target.value })} className={inputClass} /></label>
              <label><span className={labelClass}>Icon</span><input value={category.icon || ''} onChange={(event) => updateLocalCategory(category.id, { icon: event.target.value })} className={inputClass} /></label>
              <label><span className={labelClass}>Sort</span><input type="number" value={category.sortOrder} onChange={(event) => updateLocalCategory(category.id, { sortOrder: Number(event.target.value) || 1 })} className={inputClass} /></label>
              <label className="flex h-[46px] items-center gap-2 rounded-xl border border-stone-200 px-4"><input type="checkbox" checked={category.active !== false} onChange={(event) => updateLocalCategory(category.id, { active: event.target.checked })} className="h-4 w-4 accent-[#1665CC]" /><span className="text-sm font-bold text-stone-800">Active</span></label>
              <button type="button" onClick={() => saveCategory(category)} disabled={savingId === category.id} className="h-[46px] cursor-pointer rounded-xl bg-stone-950 px-4 text-sm font-bold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50">{savingId === category.id ? 'Saving...' : 'Save'}</button>
            </div>
          ))}
        </div>}
      </div>
    </section>
  );
};

export default AdminListingCategoriesPanel;
