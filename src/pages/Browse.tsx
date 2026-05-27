import React, { useEffect, useMemo, useState } from 'react';
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

const PAGE_SIZE = 12;
const FETCH_SIZE = 48;
const focusFieldClass = 'focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10 outline-none';
const selectClass = `pl-3 pr-10 py-2.5 rounded-lg border border-stone-200 text-sm bg-white ${focusFieldClass}`;

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
  const [showFilters, setShowFilters] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { void fetchListings(); }, []);

  useEffect(() => {
    const categoryFromUrl = searchParams.get('category');
    const searchFromUrl = searchParams.get('search');
    const scopeFromUrl = searchParams.get('scope');

    if (categoryFromUrl) {
      const categoryMatch = listingCategories.find((item) => item.name === categoryFromUrl || item.slug === categoryFromUrl || item.id === categoryFromUrl);
      if (categoryMatch) {
        setFilterCategory(categoryMatch.name);
        setShowFilters(true);
      }
    }

    if (searchFromUrl) {
      setSearch(searchFromUrl);
      setSearchScope(scopeFromUrl === 'book' ? 'book' : 'all');
    }
  }, [searchParams, listingCategories]);

  useEffect(() => { setCurrentPage(1); }, [search, filterType, filterCategory, filterLocation, filterCondition]);

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
    if (search.trim()) {
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
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedListings = useMemo(() => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [filtered, safePage]);
  const hasActiveQuery = Boolean(search.trim() || filterType !== 'all' || filterCategory !== 'all' || filterLocation !== 'all' || filterCondition !== 'all');

  const goToPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    setCurrentPage(nextPage);
    requestAnimationFrame(() => document.getElementById('browse-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <div className="min-h-screen pb-10 sm:pb-20">
      <section className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <nav className="mb-5 flex items-center gap-2 text-sm text-stone-500" aria-label="Breadcrumb">
            <Link to="/" className="font-semibold hover:text-primary-700">Home</Link>
            <span className="text-stone-300">/</span>
            <span className="font-semibold text-stone-900">Browse</span>
          </nav>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-2xl">
              <h1 className="text-3xl sm:text-5xl font-bold text-stone-950">Find free & affordable books near you</h1>
              <p className="text-stone-600 mt-4 text-lg">Search by title, author, genre, condition, and location.</p>
            </div>
            {currentUser && (
              <Link to="/create" className="inline-flex cursor-pointer items-center justify-center px-5 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold transition">List a Book</Link>
            )}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-5 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg border border-stone-200 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <i className="las la-search absolute left-3 top-1/2 -translate-y-1/2 text-xl text-stone-400" />
              <input type="text" placeholder="Search title, author, genre, field, condition, or location..." value={search} onChange={(event) => { setSearch(event.target.value); setSearchScope('all'); }} className={`w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 transition text-sm ${focusFieldClass}`} />
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className={`cursor-pointer flex items-center justify-center gap-2 px-5 py-3 rounded-xl border transition text-sm font-semibold ${showFilters ? 'bg-[#1665CC]/10 border-[#1665CC] text-[#1665CC]' : 'border-stone-200 text-stone-600 hover:border-[#1665CC] hover:bg-[#1665CC]/5 hover:text-[#1665CC]'}`}>
              <i className="las la-sliders-h text-lg" /> Filters
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-stone-100">
              <select value={filterType} onChange={(event) => setFilterType(event.target.value)} className={selectClass}>
                <option value="all">All Types</option><option value="swap">Swap</option><option value="donate">Donate</option><option value="sell">Sell</option>
              </select>
              <select value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)} className={selectClass}>
                <option value="all">All Categories</option>
                {listingCategories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
              </select>
              <LocationCombobox value={filterLocation} onChange={setFilterLocation} includeAllOption allOptionLabel="All Locations" allOptionValue="all" className={`${selectClass} w-full pr-11`} placeholder="Search location" />
              <select value={filterCondition} onChange={(event) => setFilterCondition(event.target.value)} className={selectClass}>
                <option value="all">All Conditions</option>{CONDITIONS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      <section id="browse-results" className="max-w-7xl mx-auto px-4 sm:px-6 py-8 scroll-mt-24">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-stone-900">{filtered.length} {filtered.length === 1 ? 'Book' : 'Books'} Loaded</h2>
          {hasActiveQuery && hasMore && <p className="mt-1 text-sm text-stone-500">Results are from recent loaded books. Load more to search further.</p>}
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">{[...Array(12)].map((_, index) => <div key={index} className="bg-white rounded-2xl border border-stone-200 overflow-hidden animate-pulse"><div className="aspect-[4/3] bg-stone-200" /><div className="p-4 space-y-3"><div className="h-4 bg-stone-200 rounded w-3/4" /><div className="h-3 bg-stone-100 rounded w-1/2" /></div></div>)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white border border-stone-200 rounded-3xl"><i className="las la-book-open text-6xl text-stone-300" /><h3 className="text-lg font-bold text-stone-800 mt-3">No books found in loaded results</h3><p className="text-stone-500 mt-1">Try adjusting your filters or load more listings.</p>{currentUser && !hasMore && <Link to="/create" className="mt-4 inline-block px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition">List the first book</Link>}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">{paginatedListings.map((listing) => <BookCard key={listing.id} listing={listing} />)}</div>
            {totalPages > 1 && (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                <button onClick={() => goToPage(safePage - 1)} disabled={safePage === 1} className="cursor-pointer rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => <button key={page} onClick={() => goToPage(page)} className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold transition ${page === safePage ? 'border-primary-600 bg-primary-600 text-white' : 'border-stone-200 text-stone-700 hover:bg-stone-50'}`}>{page}</button>)}
                <button onClick={() => goToPage(safePage + 1)} disabled={safePage === totalPages} className="cursor-pointer rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
              </div>
            )}
          </>
        )}
        {hasMore && (
          <div className="mt-8 flex justify-center">
            <button type="button" onClick={() => void fetchListings(true)} disabled={loadingMore} className="cursor-pointer rounded-xl border border-primary-200 bg-white px-6 py-3 text-sm font-semibold text-primary-700 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50">
              {loadingMore ? 'Loading more books...' : 'Load more books'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default Browse;
