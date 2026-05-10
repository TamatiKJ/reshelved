import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import BookCard from '../components/BookCard';
import type { Listing } from '../types';
import { CATEGORIES, KENYAN_CITIES, CONDITIONS } from '../types';

const Browse: React.FC = () => {
  const { currentUser } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterCondition, setFilterCondition] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'listings'),
        where('active', '==', true),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      const snap = await getDocs(q);
      const items: Listing[] = [];
      snap.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as Listing));
      setListings(items);
    } catch (err) {
      console.error('Error fetching listings:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = listings.filter((l) => {
    const now = Date.now();
    if (l.expiresAt < now) return false;
    if (filterType !== 'all' && l.type !== filterType) return false;
    if (filterCategory !== 'all' && l.category !== filterCategory) return false;
    if (filterLocation !== 'all' && l.location !== filterLocation) return false;
    if (filterCondition !== 'all' && l.condition !== filterCondition) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      return (
        l.title.toLowerCase().includes(s) ||
        l.author.toLowerCase().includes(s) ||
        l.description.toLowerCase().includes(s) ||
        l.category.toLowerCase().includes(s) ||
        l.location.toLowerCase().includes(s)
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen">
      <section className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary-600">Browse books</p>
              <h1 className="text-3xl sm:text-5xl font-bold text-stone-950 mt-3">Find affordable books near you</h1>
              <p className="text-stone-600 mt-4 text-lg">Search by title, author, genre, academic field, condition, and location.</p>
            </div>
            {currentUser ? (
              <Link to="/create" className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold transition">
                List a Book
              </Link>
            ) : (
              <Link to="/register" className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold transition">
                Join Reshelved
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-5 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg border border-stone-200 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <i className="las la-search absolute left-3 top-1/2 -translate-y-1/2 text-xl text-stone-400" />
              <input
                type="text"
                placeholder="Search title, author, genre, field, condition, or location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition text-sm"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl border transition text-sm font-semibold ${showFilters ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}
            >
              <i className="las la-sliders-h text-lg" />
              Filters
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-stone-100">
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2.5 rounded-lg border border-stone-200 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none bg-white">
                <option value="all">All Types</option>
                <option value="swap">Swap</option>
                <option value="donate">Donate</option>
                <option value="sell">Sell</option>
              </select>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-3 py-2.5 rounded-lg border border-stone-200 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none bg-white">
                <option value="all">All Categories</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} className="px-3 py-2.5 rounded-lg border border-stone-200 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none bg-white">
                <option value="all">All Locations</option>
                {KENYAN_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterCondition} onChange={(e) => setFilterCondition(e.target.value)} className="px-3 py-2.5 rounded-lg border border-stone-200 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none bg-white">
                <option value="all">All Conditions</option>
                {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { key: 'all', label: 'All Books', icon: 'las la-book' },
            { key: 'swap', label: 'Swap', icon: 'las la-sync' },
            { key: 'donate', label: 'Donate', icon: 'las la-gift' },
            { key: 'sell', label: 'Sell', icon: 'las la-tag' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setFilterType(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${filterType === t.key ? 'bg-primary-600 text-white shadow-sm' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'}`}
            >
              <i className={`${t.icon} text-base`} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-stone-900">{filtered.length} {filtered.length === 1 ? 'Book' : 'Books'} Available</h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-stone-200 overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-stone-200" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-stone-200 rounded w-3/4" />
                  <div className="h-3 bg-stone-100 rounded w-1/2" />
                  <div className="h-3 bg-stone-100 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white border border-stone-200 rounded-3xl">
            <i className="las la-book-open text-6xl text-stone-300" />
            <h3 className="text-lg font-bold text-stone-800 mt-3">No books found</h3>
            <p className="text-stone-500 mt-1">Try adjusting your filters or search terms.</p>
            {currentUser && <Link to="/create" className="mt-4 inline-block px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition">List the first book</Link>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filtered.map((listing) => <BookCard key={listing.id} listing={listing} />)}
          </div>
        )}
      </section>
    </div>
  );
};

export default Browse;
