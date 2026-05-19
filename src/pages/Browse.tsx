import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Link, useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import BookCard from '../components/BookCard';
import type { Listing } from '../types';
import { CATEGORIES, KENYAN_CITIES, CONDITIONS } from '../types';
import { parseListingSnapshot } from '../services/listingValidation';
import { safeLower } from '../utils/stringGuards';

const PAGE_SIZE = 12;
const focusFieldClass = 'focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10 outline-none';
const selectClass = `pl-3 pr-10 py-2.5 rounded-lg border border-stone-200 text-sm bg-white ${focusFieldClass}`;

const Browse: React.FC = () => {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchScope, setSearchScope] = useState<'all' | 'book'>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterCondition, setFilterCondition] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { fetchListings(); }, []);

  useEffect(() => {
    const categoryFromUrl = searchParams.get('category');
    const searchFromUrl = searchParams.get('search');
    const scopeFromUrl = searchParams.get('scope');

    if (categoryFromUrl && CATEGORIES.includes(categoryFromUrl)) {
      setFilterCategory(categoryFromUrl);
      setShowFilters(true);
    }

    if (searchFromUrl) {
      setSearch(searchFromUrl);
      setSearchScope(scopeFromUrl === 'book' ? 'book' : 'all');
    }
  }, [searchParams]);

  useEffect(() => { setCurrentPage(1); }, [search, filterType, filterCategory, filterLocation, filterCondition]);

  const fetchListings = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, 'listings'));
      const items = parseListingSnapshot(snap).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setListings(items);
    } catch (err) {
      console.error('Error fetching listings:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = listings.filter((l) => {
    const now = Date.now();
    if (!l.active || l.expiresAt < now) return false;
    if (filterType !== 'all' && l.type !== filterType) return false;
    if (filterCategory !== 'all' && l.category !== filterCategory) return false;
    if (filterLocation !== 'all' && l.location !== filterLocation) return false;
    if (filterCondition !== 'all' && l.condition !== filterCondition) return false;
    if (search.trim()) {
      const s = safeLower(search);
      const title = safeLower(l.title);
      const author = safeLower(l.author);

      if (searchScope === 'book') {
        return title.includes(s) || author.includes(s);
      }

      return (
        title.includes(s) ||
        author.includes(s) ||
        safeLower(l.description).includes(s) ||
        safeLower(l.category).includes(s) ||
        safeLower(l.condition).includes(s) ||
        safeLower(l.location).includes(s) ||
        safeLower(l.type).includes(s)
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedListings = useMemo(() => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [filtered, safePage]);

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
              <h1 className="text-3xl sm:text-5xl font-bold text-stone-950">Find affordable books near you</h1>
              <p className="text-stone-600 mt-4 text-lg">Search by title, author, genre, academic field, condition, and location.</p>
            </div>
            {currentUser ? <Link to="/create" className="inline-flex cursor-pointer items-center justify-center px-5 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold transition">List a Book</Link> : <Link to="/register" className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold transition">Join Reshelved</Link>}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-5 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg border border-stone-200 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <i className="las la-search absolute left-3 top-1/2 -translate-y-1/2 text-xl text-stone-400" />
              <input type="text" placeholder="Search title, author, genre, field, condition, or location..." value={search} onChange={(e) => { setSearch(e.target.value); setSearchScope('all'); }} className={`w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 transition text-sm ${focusFieldClass}`} />
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className={`cursor-pointer flex items-center justify-center gap-2 px-5 py-3 rounded-xl border transition text-sm font-semibold ${showFilters ? 'bg-[#1665CC]/10 border-[#1665CC] text-[#1665CC]' : 'border-stone-200 text-stone-600 hover:border-[#1665CC] hover:bg-[#1665CC]/5 hover:text-[#1665CC]'}`}>
              <i className="las la-sliders-h text-lg" /> Filters
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-stone-100">
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={selectClass}><option value="all">All Types</option><option value="swap">Swap</option><option value="donate">Donate</option><option value="sell">Sell</option></select>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={selectClass}><option value="all">All Categories</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} className={selectClass}><option value="all">All Locations</option>{KENYAN_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              <select value={filterCondition} onChange={(e) => setFilterCondition(e.target.value)} className={selectClass}><option value="all">All Conditions</option>{CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            </div>
          )}
        </div>
      </div>

      <section id="browse-results" className="max-w-7xl mx-auto px-4 sm:px-6 py-8 scroll-mt-24">
        <h2 className="text-xl font-bold text-stone-900 mb-6">{filtered.length} {filtered.length === 1 ? 'Book' : 'Books'} Available</h2>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">{[...Array(12)].map((_, i) => <div key={i} className="bg-white rounded-2xl border border-stone-200 overflow-hidden animate-pulse"><div className="aspect-[4/3] bg-stone-200" /><div className="p-4 space-y-3"><div className="h-4 bg-stone-200 rounded w-3/4" /><div className="h-3 bg-stone-100 rounded w-1/2" /></div></div>)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white border border-stone-200 rounded-3xl"><i className="las la-book-open text-6xl text-stone-300" /><h3 className="text-lg font-bold text-stone-800 mt-3">No books found</h3><p className="text-stone-500 mt-1">Try adjusting your filters or search terms.</p>{currentUser && <Link to="/create" className="mt-4 inline-block px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition">List the first book</Link>}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">{paginatedListings.map((listing) => <BookCard key={listing.id} listing={listing} />)}</div>
            {totalPages > 1 && (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                <button onClick={() => goToPage(safePage - 1)} disabled={safePage === 1} className="cursor-pointer rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => <button key={page} onClick={() => goToPage(page)} className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold transition ${page === safePage ? 'border-primary-600 bg-primary-600 text-white' : 'border-stone-200 text-stone-700 hover:bg-stone-50'}`}>{page}</button>)}
                <button onClick={() => goToPage(safePage + 1)} disabled={safePage === totalPages} className="cursor-pointer rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default Browse;