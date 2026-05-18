import React, { useCallback, useEffect, useRef, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import AdminUserDashboardNotifyWrapper from './AdminUserDashboardNotifyWrapper';
import './AdminListingsManagementWrapper.css';

type AdminListingRow = {
  id: string;
  title?: string;
  author?: string;
  category?: string;
  userName?: string;
  location?: string;
  createdAt?: number;
  active?: boolean;
  deleted?: boolean;
  deletedAt?: number;
  images?: string[];
};

const textOf = (element: Element | null) => element?.textContent?.trim().toLowerCase() || '';
const isDeletedListing = (listing: AdminListingRow) => Boolean(listing.deleted || listing.deletedAt);
const formatDate = (timestamp?: number) => timestamp ? new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Not recorded';

const AdminListingsManagementWrapper: React.FC = () => {
  const [listings, setListings] = useState<AdminListingRow[]>([]);
  const deletedModeRef = useRef(false);
  const deletedTitlesRef = useRef(new Set<string>());

  const loadListings = useCallback(async () => {
    const snap = await getDocs(collection(db, 'listings'));
    const next: AdminListingRow[] = [];
    snap.forEach((item) => next.push({ id: item.id, ...item.data() } as AdminListingRow));
    next.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    setListings(next);
    deletedTitlesRef.current = new Set(next.filter(isDeletedListing).map((item) => item.title || '').filter(Boolean));
    return next;
  }, []);

  const findPanel = () => {
    const panels = Array.from(document.querySelectorAll<HTMLElement>('.admin-tiktok-shell section'));
    return panels.find((panel) => panel.querySelector('h3')?.textContent?.trim() === 'Listings') || null;
  };

  const hideDeletedRowsFromNormalLists = useCallback(() => {
    if (deletedModeRef.current) return;
    const panel = findPanel();
    if (!panel) return;
    panel.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((row) => {
      const title = row.querySelector('td')?.textContent?.trim() || '';
      row.style.display = deletedTitlesRef.current.has(title) ? 'none' : '';
    });
  }, []);

  const renderDeletedListings = useCallback((panel: HTMLElement, items = listings) => {
    deletedModeRef.current = true;
    const originalTable = panel.querySelector<HTMLElement>('.overflow-x-auto');
    if (originalTable) originalTable.style.display = 'none';

    panel.querySelector('.admin-deleted-listings-table')?.remove();
    const searchInput = panel.querySelector<HTMLInputElement>('input[placeholder="Search listings..."]');
    const query = searchInput?.value.trim().toLowerCase() || '';
    const deletedItems = items.filter(isDeletedListing).filter((item) => [item.title, item.author, item.category, item.userName, item.location].join(' ').toLowerCase().includes(query));

    const wrap = document.createElement('div');
    wrap.className = 'admin-deleted-listings-table overflow-x-auto';
    wrap.innerHTML = `
      <table class="w-full min-w-[1120px] text-left text-sm">
        <thead class="border-b border-stone-200 text-[13px] font-bold uppercase tracking-[2px] text-stone-500">
          <tr><th class="py-3">Title</th><th>Author</th><th>Category</th><th>Seller</th><th>Location</th><th>Deleted</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody class="divide-y divide-stone-100">
          ${deletedItems.map((item) => `<tr data-listing-id="${item.id}"><td class="py-3 font-semibold">${item.title || 'Untitled'}</td><td>${item.author || ''}</td><td>${item.category || ''}</td><td>${item.userName || ''}</td><td>${item.location || ''}</td><td>${formatDate(item.deletedAt || item.createdAt)}</td><td><span class="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">Deleted</span></td><td><button type="button" class="admin-permanent-delete-listing">Permanently delete</button></td></tr>`).join('')}
        </tbody>
      </table>
      ${deletedItems.length === 0 ? '<div class="admin-deleted-empty">No deleted listings found.</div>' : ''}
    `;
    panel.appendChild(wrap);

    wrap.querySelectorAll<HTMLButtonElement>('.admin-permanent-delete-listing').forEach((button) => {
      button.addEventListener('click', async () => {
        const row = button.closest<HTMLTableRowElement>('tr');
        const id = row?.dataset.listingId;
        if (!id || !window.confirm('Permanently delete this listing? This cannot be undone.')) return;
        await deleteDoc(doc(db, 'listings', id));
        row?.remove();
        const next = await loadListings();
        renderDeletedListings(panel, next);
      });
    });
  }, [listings, loadListings]);

  const showOriginalListingTable = useCallback(() => {
    deletedModeRef.current = false;
    const panel = findPanel();
    if (!panel) return;
    panel.querySelector('.admin-deleted-listings-table')?.remove();
    const originalTable = panel.querySelector<HTMLElement>('.overflow-x-auto');
    if (originalTable) originalTable.style.display = '';
    hideDeletedRowsFromNormalLists();
  }, [hideDeletedRowsFromNormalLists]);

  const enhanceListingPanel = useCallback(async () => {
    const panel = findPanel();
    if (!panel) return;
    const latest = listings.length ? listings : await loadListings();
    const deletedCount = latest.filter(isDeletedListing).length;
    const visibleCount = latest.length - deletedCount;
    const activeCount = latest.filter((item) => !isDeletedListing(item) && item.active).length;
    const inactiveCount = latest.filter((item) => !isDeletedListing(item) && !item.active).length;

    const filterWrap = panel.querySelector<HTMLElement>('.mb-4.flex.flex-wrap.items-center.gap-2');
    if (!filterWrap) return;

    const buttons = Array.from(filterWrap.querySelectorAll<HTMLButtonElement>('button'));
    const activeButton = buttons.find((button) => textOf(button).startsWith('active'));
    const inactiveButton = buttons.find((button) => textOf(button).startsWith('inactive'));
    const allButton = buttons.find((button) => textOf(button).startsWith('all'));
    if (!activeButton || !inactiveButton || !allButton) return;

    allButton.innerHTML = `All listings <span class="opacity-70">(${visibleCount})</span>`;
    activeButton.innerHTML = `Active <span class="opacity-70">(${activeCount})</span>`;
    inactiveButton.innerHTML = `Inactive <span class="opacity-70">(${inactiveCount})</span>`;

    let deletedButton = filterWrap.querySelector<HTMLButtonElement>('.admin-deleted-listings-filter');
    if (!deletedButton) {
      deletedButton = document.createElement('button');
      deletedButton.type = 'button';
      deletedButton.className = 'admin-deleted-listings-filter cursor-pointer rounded-full border px-4 py-2 text-sm font-bold transition border-stone-200 text-stone-600 hover:border-[#1665CC] hover:text-[#1665CC]';
      deletedButton.addEventListener('click', () => {
        [allButton, activeButton, inactiveButton].forEach((button) => button.classList.remove('border-[#1665CC]', 'bg-[#1665CC]/10', 'text-[#1665CC]'));
        deletedButton?.classList.add('border-[#1665CC]', 'bg-[#1665CC]/10', 'text-[#1665CC]');
        renderDeletedListings(panel);
      });
    }
    deletedButton.innerHTML = `Deleted <span class="opacity-70">(${deletedCount})</span>`;

    filterWrap.innerHTML = '';
    filterWrap.append(allButton, activeButton, inactiveButton, deletedButton);

    [allButton, activeButton, inactiveButton].forEach((button) => {
      if (button.dataset.adminDeletedAware === 'true') return;
      button.dataset.adminDeletedAware = 'true';
      button.addEventListener('click', () => window.setTimeout(showOriginalListingTable, 0));
    });

    panel.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
      if (button.textContent?.trim() !== 'Delete' || button.dataset.adminSoftDelete === 'true') return;
      button.dataset.adminSoftDelete = 'true';
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const row = button.closest<HTMLTableRowElement>('tr');
        const title = row?.querySelector('td')?.textContent?.trim() || '';
        const item = latest.find((listing) => listing.title === title && !isDeletedListing(listing));
        if (!item || !window.confirm('Move this listing to Deleted? You can permanently delete it from the Deleted tab.')) return;
        await updateDoc(doc(db, 'listings', item.id), { active: false, deleted: true, deletedAt: Date.now() });
        row?.remove();
        await loadListings();
        enhanceListingPanel();
      }, true);
    });

    hideDeletedRowsFromNormalLists();
  }, [hideDeletedRowsFromNormalLists, listings, loadListings, renderDeletedListings, showOriginalListingTable]);

  useEffect(() => { loadListings(); }, [loadListings]);

  useEffect(() => {
    const observer = new MutationObserver(() => enhanceListingPanel());
    observer.observe(document.body, { childList: true, subtree: true });
    enhanceListingPanel();
    return () => observer.disconnect();
  }, [enhanceListingPanel]);

  return <AdminUserDashboardNotifyWrapper />;
};

export default AdminListingsManagementWrapper;
