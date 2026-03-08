import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import BookCard from '../components/BookCard';
import type { Listing } from '../types';
import { CATEGORIES, KENYAN_CITIES, CONDITIONS } from '../types';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  const { currentUser } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterCondition, setFilterCondition] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

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
      snap.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Listing);
      });
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
        l.description.toLowerCase().includes(s)
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary-700 via-primary-600 to-primary-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
          <div className="max-w-2xl">
            <h1 className="text-3xl sm:text-5xl font-bold leading-tight">
              Give your books a<br />
              <span className="text-accent-300">second life</span>
            </h1>
            <p className="mt-4 text-primary-100 text-lg sm:text-xl leading-relaxed">
              Swap, donate, or resell books across Kenya. Join the community of readers making books accessible for everyone.
            </p>
            {!currentUser && (
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/register" className="px-6 py-3 bg-white text-primary-700 font-semibold rounded-xl hover:bg-primary-50 transition shadow-lg">
                  Get Started Free
                </Link>
                <Link to="/login" className="px-6 py-3 bg-primary-500/30 text-white font-semibold rounded-xl hover:bg-primary-500/50 transition border border-white/20">
                  Log In
                </Link>
              </div>
            )}
            {currentUser && (
              <div className="mt-8">
                <Link to="/create" className="inline-flex items-center gap-2 px-6 py-3 bg-accent-500 text-white font-semibold rounded-xl hover:bg-accent-600 transition shadow-lg">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  List a Book
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-6">
        <div className="bg-white rounded-2xl shadow-lg border border-stone-200 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by title, author, or keyword..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition text-sm"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl border transition text-sm font-medium ${showFilters ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
              Filters
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-stone-100">
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2.5 rounded-lg border border-stone-200 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none bg-white">
                <option value="all">All Types</option>
                <option value="swap">Swap</option>
                <option value="donate">Free / Donate</option>
                <option value="sell">For Sale</option>
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

      {/* Type Chips */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { key: 'all', label: 'All Books', icon: '📚' },
            { key: 'swap', label: 'Swap', icon: '🔄' },
            { key: 'donate', label: 'Free Books', icon: '🎁' },
            { key: 'sell', label: 'For Sale', icon: '💰' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setFilterType(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                filterType === t.key ? 'bg-primary-600 text-white shadow-sm' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Listings */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-stone-800">
            {filtered.length} {filtered.length === 1 ? 'Book' : 'Books'} Available
          </h2>
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
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto bg-stone-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </div>
            <h3 className="text-lg font-semibold text-stone-700">No books found</h3>
            <p className="text-stone-500 mt-1">Try adjusting your filters or search terms</p>
            {currentUser && (
              <Link to="/create" className="mt-4 inline-block px-5 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition">
                List the first book
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filtered.map((listing) => (
              <BookCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <span className="font-bold text-primary-700">Reshelved</span>
            </div>
            <p className="text-sm text-stone-500">© 2024 Reshelved. Connecting readers across Kenya 🇰🇪</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
