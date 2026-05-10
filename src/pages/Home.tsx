import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import BookCard from '../components/BookCard';
import type { Listing } from '../types';

const publisherPlaceholders = ['Publisher', 'Bookshop', 'Campus', 'Library', 'Reader', 'Vendor'];

const Home: React.FC = () => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'listings'), where('active', '==', true), orderBy('createdAt', 'desc'), limit(4));
      const snap = await getDocs(q);
      const items: Listing[] = [];
      snap.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as Listing));
      setListings(items.filter((item) => item.expiresAt > Date.now()));
    } catch (err) {
      console.error('Error fetching listings:', err);
    } finally {
      setLoading(false);
    }
  };

  const searchTarget = search.trim() ? `/browse?search=${encodeURIComponent(search.trim())}` : '/browse';

  return (
    <div className="min-h-screen bg-white">
      <section className="bg-[#121212] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-24 sm:py-32">
          <div className="max-w-3xl">
            <h1 className="text-5xl sm:text-7xl font-bold leading-[1.08] tracking-tight">
              Find the Books You Need Without Paying Full Price
            </h1>
            <p className="mt-8 text-xl text-white/85 leading-relaxed max-w-2xl">
              Reshelved helps you search affordable physical books by title, author, genre, academic field, condition, and location — all in one platform.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/browse" className="inline-flex items-center justify-center px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-md transition">
                Start Finding Books
              </Link>
              <Link to="/create" className="inline-flex items-center justify-center px-5 py-3 text-white font-semibold rounded-md border border-white/70 hover:bg-white hover:text-stone-950 transition">
                List a Book <i className="las la-angle-right ml-1" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="relative -mt-10 bg-white rounded-t-[42px] sm:rounded-t-[56px] pt-12 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row gap-4 items-stretch">
            <div className="flex-1 relative">
              <i className="las la-search absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-stone-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search across 500+ books..."
                className="w-full h-12 pl-12 pr-4 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <div className="inline-flex rounded-xl bg-stone-100 p-1 self-start lg:self-auto">
              <Link to={searchTarget} className="px-5 py-3 rounded-lg bg-white text-primary-600 shadow-sm text-sm font-bold">Books</Link>
              <Link to="/browse" className="px-5 py-3 rounded-lg text-stone-500 text-sm font-bold">People</Link>
            </div>
          </div>

          <div className="mt-10 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-stone-950">Latest Books</h2>
            <Link to="/browse" className="text-sm font-semibold text-primary-600 hover:text-primary-700">View all</Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-stone-200 overflow-hidden animate-pulse bg-white">
                  <div className="aspect-[4/3] bg-stone-200" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-stone-200 rounded w-3/4" />
                    <div className="h-3 bg-stone-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : listings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-6">
              {listings.map((listing) => <BookCard key={listing.id} listing={listing} />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="aspect-[4/3] bg-stone-200 rounded-sm" />
              ))}
            </div>
          )}

          <div className="mt-8 flex flex-wrap justify-center gap-8 border-b border-stone-200 pb-8">
            {publisherPlaceholders.map((name) => (
              <div key={name} className="w-28 h-10 bg-yellow-200 flex items-center justify-center text-[10px] font-bold text-yellow-900/50 uppercase tracking-wide">
                {name}
              </div>
            ))}
          </div>
          <p className="text-center text-xs font-semibold text-stone-400 mt-3">Collections from Top Publishers</p>
        </div>
      </section>

      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="max-w-xl">
            <h2 className="text-4xl sm:text-5xl font-bold text-stone-950 leading-tight">Book Hunting Should Not Be This Hard</h2>
            <p className="mt-8 text-stone-600 leading-relaxed">
              The book you need is probably sitting on someone’s shelf right now. But finding it means asking around, scrolling through old posts, comparing prices, and hoping you do not get ignored or overcharged.
            </p>
            <Link to="/browse" className="mt-8 inline-flex px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-md transition">
              Start Finding Books
            </Link>
          </div>

          <div className="relative min-h-[360px] lg:min-h-[420px] flex items-center justify-center">
            <img
              src="/home-pain-points-composition.svg"
              alt="Book hunting pain points: sellers feel risky, hard to find titles, and new books cost too much"
              className="w-full max-w-[560px] h-auto object-contain"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      <section className="relative bg-[#121212] text-white pt-28 pb-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-48 mb-28">
          <div className="bg-[#f5eee3] text-stone-950 rounded-[28px] sm:rounded-[36px] px-6 sm:px-16 py-16 sm:py-24 text-center">
            <h2 className="text-4xl sm:text-6xl font-bold leading-tight">Don’t let your books<br />sit unused</h2>
            <p className="mt-8 text-stone-700">Someone needs what you already have.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/create" className="px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-md transition">List a Book</Link>
              <Link to="/browse" className="px-5 py-3 border border-stone-900 text-stone-900 font-semibold rounded-md hover:bg-stone-900 hover:text-white transition">Find Books</Link>
            </div>
            <p className="mt-3 text-xs text-stone-500">Quick Sign Up | It’s 100% Free!</p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center min-h-[320px]">
            <h2 className="text-4xl sm:text-6xl font-bold">See what others say</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-end border-b border-white/25 pb-16">
            <div className="flex items-center gap-8">
              <h2 className="text-6xl sm:text-8xl font-bold leading-none">Start free<br />today</h2>
              <Link to="/register" className="w-16 h-16 rounded-full bg-primary-600 hover:bg-primary-700 flex items-center justify-center transition shrink-0">
                <i className="las la-play text-3xl text-black" />
              </Link>
            </div>
            <p className="text-white/80 text-lg max-w-md lg:ml-auto">
              Built with feedback from readers across Nairobi. Try Reshelved and see why they love it.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
