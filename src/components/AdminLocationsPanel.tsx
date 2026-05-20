import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createLocation, getLocations, seedDefaultLocations, updateLocation, type LocationOption } from '../services/locations';

const inputClass = 'w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10 disabled:bg-stone-50';
const labelClass = 'mb-1.5 block text-sm font-bold text-stone-950';

type DraftLocation = Pick<LocationOption, 'name' | 'sortOrder' | 'active'>;

const AdminLocationsPanel: React.FC = () => {
  const { currentUser } = useAuth();
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<DraftLocation>({ name: '', sortOrder: 1, active: true });

  const nextSortOrder = useMemo(() => locations.length === 0 ? 1 : Math.max(...locations.map((item) => Number(item.sortOrder || 0))) + 1, [locations]);
  const showMessage = (text: string) => { setMessage(text); window.setTimeout(() => setMessage(''), 2800); };

  const loadLocations = async () => {
    setLoading(true);
    try { setLocations(await getLocations({ includeInactive: true })); }
    catch (error) { console.error('Could not load locations:', error); showMessage('Could not load locations. Check Firestore rules.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadLocations(); }, []);
  useEffect(() => { setDraft((current) => ({ ...current, sortOrder: nextSortOrder })); }, [nextSortOrder]);

  const addLocation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || !currentUser) return;
    setSavingId('new');
    try {
      const created = await createLocation({ name: draft.name, sortOrder: draft.sortOrder, createdBy: currentUser.uid });
      setLocations((current) => [...current, created].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
      setDraft({ name: '', sortOrder: nextSortOrder + 1, active: true });
      showMessage('Location created.');
    } catch (error: any) { showMessage(error?.message || 'Location could not be created.'); }
    finally { setSavingId(null); }
  };

  const updateLocalLocation = (id: string, updates: Partial<LocationOption>) => setLocations((current) => current.map((item) => item.id === id ? { ...item, ...updates } : item));

  const saveLocation = async (location: LocationOption) => {
    if (!location.name.trim()) return showMessage('Location name cannot be empty.');
    setSavingId(location.id);
    try {
      await updateLocation(location.id, { name: location.name, sortOrder: Number(location.sortOrder) || 1, active: location.active !== false });
      setLocations((current) => [...current].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
      showMessage('Location saved.');
    } catch (error) { console.error('Could not save location:', error); showMessage('Location could not be saved. Check Firestore rules.'); }
    finally { setSavingId(null); }
  };

  const seedDefaults = async () => {
    if (!currentUser) return;
    setSavingId('seed');
    try {
      const count = await seedDefaultLocations(currentUser.uid);
      await loadLocations();
      showMessage(count > 0 ? `${count} default locations added.` : 'Default locations already exist.');
    } catch (error) { console.error('Could not seed default locations:', error); showMessage('Default locations could not be added. Check Firestore rules.'); }
    finally { setSavingId(null); }
  };

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-[15px] font-bold text-stone-950">Locations</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Manage the locations used on Create Listing, Edit Listing, and Browse filters.</p>
        </div>
        <button type="button" onClick={seedDefaults} disabled={savingId === 'seed'} className="w-fit cursor-pointer rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-bold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50">{savingId === 'seed' ? 'Adding...' : 'Seed defaults'}</button>
      </div>

      {message && <div className="mb-5 rounded-2xl border border-[#1665CC]/20 bg-[#1665CC]/5 px-4 py-3 text-sm font-bold text-[#1665CC]">{message}</div>}

      <form onSubmit={addLocation} className="mb-6 rounded-2xl border border-stone-200 bg-stone-50 p-5">
        <h4 className="text-sm font-bold text-stone-950">Add location</h4>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_120px]">
          <label><span className={labelClass}>Name</span><input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className={inputClass} placeholder="e.g. Kilimani" /></label>
          <label><span className={labelClass}>Sort</span><input type="number" value={draft.sortOrder} onChange={(event) => setDraft((current) => ({ ...current, sortOrder: Number(event.target.value) || 1 }))} className={inputClass} /></label>
        </div>
        <button type="submit" disabled={!draft.name.trim() || savingId === 'new'} className="mt-4 cursor-pointer rounded-xl bg-[#1665CC] px-5 py-3 text-sm font-bold text-white hover:bg-[#1254a9] disabled:cursor-not-allowed disabled:opacity-50">{savingId === 'new' ? 'Adding...' : 'Add location'}</button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-stone-200">
        <div className="border-b border-stone-100 bg-white px-5 py-4"><h4 className="text-sm font-bold text-stone-950">Current locations</h4></div>
        {loading ? <div className="p-8 text-center text-sm text-stone-500">Loading locations...</div> : locations.length === 0 ? <div className="p-8 text-center text-sm text-stone-500">No locations yet. Seed defaults or add your first location.</div> : <div className="divide-y divide-stone-100 bg-white">
          {locations.map((location) => <div key={location.id} className="grid gap-4 p-5 lg:grid-cols-[1.2fr_110px_120px_110px] lg:items-end">
            <label><span className={labelClass}>Name</span><input value={location.name} onChange={(event) => updateLocalLocation(location.id, { name: event.target.value })} className={inputClass} /></label>
            <label><span className={labelClass}>Sort</span><input type="number" value={location.sortOrder} onChange={(event) => updateLocalLocation(location.id, { sortOrder: Number(event.target.value) || 1 })} className={inputClass} /></label>
            <label className="flex h-[46px] items-center gap-2 rounded-xl border border-stone-200 px-4"><input type="checkbox" checked={location.active !== false} onChange={(event) => updateLocalLocation(location.id, { active: event.target.checked })} className="h-4 w-4 accent-[#1665CC]" /><span className="text-sm font-bold text-stone-800">Active</span></label>
            <button type="button" onClick={() => saveLocation(location)} disabled={savingId === location.id} className="h-[46px] cursor-pointer rounded-xl bg-stone-950 px-4 text-sm font-bold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50">{savingId === location.id ? 'Saving...' : 'Save'}</button>
          </div>)}
        </div>}
      </div>
    </section>
  );
};

export default AdminLocationsPanel;
