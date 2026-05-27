import React, { useEffect, useRef, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, startAfter } from 'firebase/firestore';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { Link, useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import BookCard from '../components/BookCard';
import type { Listing } from '../types';
import { CONDITIONS } from '../types';
import LocationCombobox from '../components/LocationCombobox';
import { parseListingSnapshot } from '../services/listingValidation';
import { safeLower } from '../utils/stringGuards';
import { useListingCategories } from '../hooks/useListingCategories';

const FETCH_SIZE = 24;
const focusFieldClass = 'focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10 outline-none';
const selectClass = `w-full rounded-xl border border-stone-200 bg-white px-3 py-3 pr-10 text-sm text-stone-700 ${focusFieldClass}`;

const Browse: React.FC = () => {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const { categories: listingCategories } = useListingCategories();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState('');
  const [searchScope, setSearchScope] = useState<'all' | 'book'>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterCondition, setFilterCondition] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => { void fetchListings(); }, []);

  useEffect(() => {
    const categoryFromUrl = searchParams.get('category');
    const searchFromUrl = searchParams.get('search');
    const scopeFromUrl = searchParams.get('scope');

    if (categoryFromUrl) {
      const categoryMatch = listingCategories.find((item) => item.name === categoryFromUrl || item.slug === categoryFromUrl || item.id === categoryFromUrl);
      if (categoryMatch) setFilterCategory(categoryMatch.name);
    }

    if (searchFromUrl) {
      setSearch(searchFromUrl);
      setSearchScope(scopeFromUrl === 'book' ? 'book' : 'all');
    }
  }, [searchParams, listingCategories]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasMore || loading || loadingMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void fetchListings(true);
      },
      { rootMargin: '420px 0px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, lastVisible]);

  const fetchListings = async (loadMore = false) => {
    if (loadMore && (!lastVisible || loadingMore)) return;

    try {
      loadMore ? setLoadingMore(true) : setLoading(true);
      const listingsQuery = loadMore && lastVisible
        ? query(collection(db, 'listings'), orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(FETCH_SIZE))
        : query(collection(db, 'listings'), orderBy('createdAt', 'desc'), limit(FETCH_SIZE));
      const snap = await getDocs(listingsQuery);
      const items = parseListingSnapshot(snap).filter((item) => item.active && item.expiresAt > Date.now());
      setListings((previous) => loadMore ? [...previous, ...items] : items);
      setLastVisible(snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null);
      setHasMore(snap.docs.length === FETCH_SIZE);
    } catch (err) {
      console.error('Error fetching listings:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const filtered = listings.filter((listing) => {
    if (filterType !== 'all' && listing.type !== filterType) return false;
    if (filterCategory !== 'all' && (listing.categoryName || listing.category) !== filterCategory && listing.categoryId !== filterCategory) return false;
    if (filterLocation !== 'all' && listing.location !== filterLocation) return false;
    if (filterCondition !== 'all' && listing.condition !== filterCondition) return false;
    if (!search.trim()) return true;

    const term = safeLower(search);
    const title = safeLower(listing.title);
    const author = safeLower(listing.author);
    if (searchScope === 'book') return title.includes(term) || author.includes(term);

    return title.includes(term)
      || author.includes(term)
      || safeLower(listing.description).includes(term)
      || safeLower(listing.categoryName || listing.category).includes(term)
      || safeLower(listing.condition).includes(term)
      || safeLower(listing.location).includes(term)
      || safeLower(listing.type).includes(term);
  });

  const hasActiveFilters = filterType !== 'all' || filterCategory !== 'all' || filterLocation !== 'all' || filterCondition !== 'all';
  const hasActiveQuery = Boolean(search.trim() || hasActiveFilters);

  const resetFilters = () => {
    setFilterType('all');
    setFilterCategory('all');
    setFilterLocation('all');
    setFilterCondition('all');
  };

  const filterControls = (
    <>
      <div className="flex items-center justify-between border-b border-stone-100 pb-4">
        <h2 className="text-lg font-bold text-stone-950">Filters</h2>
        {hasActiveFilters && <button type="button" onClick={resetFilters} className="cursor-pointer text-xs font-bold text-primary-600 hover:text-primary-700">Clear all</button>}
      </div>
      <div className="mt-5 space-y-6">
        <div>
          <label className="mb-2 block text-sm font-bold text-stone-900">Listing type</label>
          <select value={filterType} onChange={(event) => setFilterType(event.target.value)} className={selectClass}>
            <option value="all">All types</option>
            <option value="sell">For sale</option>
            <option value="swap">Available to swap</option>
            <option value="donate">Free / donate</option>
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-bold text-stone-900">Category</label>
          <select value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)} className={selectClass}>
            <option value="all">All categories</option>
            {listingCategories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-bold text-stone-900">Location</label>
          <LocationCombobox value={filterLocation} onChange={setFilterLocation} includeAllOption allOptionLabel="All locations" allOptionValue="all" className={`${selectClass} pr-11`} placeholder="Search location" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-bold text-stone-900">Book condition</label>
          <select value={filterCondition} onChange={(event) => setFilterCondition(event.target.value)} className={selectClass}>
            <option value="all">All conditions</option>
            {CONDITIONS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
          </select>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen pb-10 sm:pb-20">
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <nav className="mb-5 flex items-center gap-2 text-sm text-stone-500" aria-label="Breadcrumb">
            <Link to="/" className="font-semibold hover:text-primary-700">Home</Link>
            <span className="text-stone-300">/</span>
            <span className="font-semibold text-stone-900">Browse</span>
          </nav>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-bold text-stone-950 sm:text-5xl">Find free & affordable books near you</h1>
              <p className="mt-4 text-lg text-stone-600">Search by title, author, genre, condition, and location.</p>
            </div>
            {currentUser && <Link to="/create" className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-primary-600 px-5 py-3 font-semibold text-white transition hover:bg-primary-700">List a Book</Link>}
          </div>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-5 max-w-7xl px-4 sm:px-6">
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-lg sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <i className="las la-search absolute left-3 top-1/2 -translate-y-1/2 text-xl text-stone-400" />
              <input type="text" placeholder="Search title, author, genre, condition, or location..." value={search} onChange={(event) => { setSearch(event.target.value); setSearchScope('all'); }} className={`w-full rounded-xl border border-stone-200 py-3 pl-10 pr-4 text-sm transition ${focusFieldClass}`} />
            </div>
            <button type="button" onClick={() => setShowFilters((current) => !current)} className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition lg:hidden ${showFilters ? 'border-[#1665CC] bg-[#1665CC]/10 text-[#1665CC]' : 'border-stone-200 text-stone-600 hover:border-[#1665CC] hover:text-[#1665CC]'}`}>
              <i className="las la-sliders-h text-lg" /> Filters
            </button>
          </div>
          <div className={`${showFilters ? 'block' : 'hidden'} mt-4 border-t border-stone-100 pt-4 lg:hidden`}>
            {filterControls}
          </div>
        </div>
      </div>

      <section id="browse-results" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
          <aside className="hidden rounded-2xl border border-stone-200 bg-white p-5 lg:sticky lg:top-24 lg:block">
            {filterControls}
          </aside>

          <div className="min-w-0">
            <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-xl font-bold text-stone-900">{filtered.length} {filtered.length === 1 ? 'Book' : 'Books'} Found</h2>
                {hasActiveQuery && hasMore && <p className="mt-1 text-sm text-stone-500">More matching books may appear as you scroll.</p>}
              </div>
              {hasActiveFilters && <button type="button" onClick={resetFilters} className="hidden cursor-pointer text-sm font-bold text-primary-600 hover:text-primary-700 lg:block">Reset filters</button>}
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">{[...Array(9)].map((_, index) => <div key={index} className="overflow-hidden rounded-2xl border border-stone-200 bg-white animate-pulse"><div className="aspect-[4/3] bg-stone-200" /><div className="space-y-3 p-4"><div className="h-4 w-3/4 rounded bg-stone-200" /><div className="h-3 w-1/2 rounded bg-stone-100" /></div></div>)}</div>
            ) : filtered.length === 0 && !hasMore ? (
              <div className="rounded-3xl border border-stone-200 bg-white py-16 text-center"><i className="las la-book-open text-6xl text-stone-300" /><h3 className="mt-3 text-lg font-bold text-stone-800">No books found</h3><p className="mt-1 text-stone-500">Try changing your filters or search terms.</p>{currentUser && <Link to="/create" className="mt-4 inline-block rounded-xl bg-primary-600 px-5 py-2.5 font-semibold text-white transition hover:bg-primary-700">List the first book</Link>}</div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((listing) => <BookCard key={listing.id} listing={listing} />)}</div>
            )}

            <div ref={loadMoreRef} aria-hidden="true" className="h-px" />
            {loadingMore && <div className="mt-8 flex items-center justify-center gap-2 text-sm font-semibold text-stone-500"><span className="h-5 w-5 animate-spin rounded-full border-2 border-stone-200 border-t-primary-600" />Loading more books...</div>}
            {!loading && !loadingMore && !hasMore && filtered.length > 0 && <p className="mt-10 text-center text-sm text-stone-400">You have reached the end of the available books.</p>}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Browse;
