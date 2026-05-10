import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import BookCard from '../components/BookCard';
import type { Listing } from '../types';

const Home: React.FC = () => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden bg-[#fff7f3]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(213,66,21,0.16),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(0,0,0,0.06),transparent_30%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-primary-600">Reshelved Nairobi</p>
            <h1 className="mt-5 text-4xl sm:text-6xl font-bold leading-[1.02] text-stone-950">
              Find the Books You Need Without Paying Full Price
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-stone-700 leading-relaxed max-w-2xl">
              Reshelved helps you search affordable physical books by title, author, genre, academic field, condition, and location — all in one platform.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link to="/browse" className="inline-flex items-center justify-center px-6 py-3.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition shadow-lg shadow-primary-600/20">
                Start Finding Books
              </Link>
              <Link to="/create" className="inline-flex items-center justify-center px-6 py-3.5 bg-white text-primary-600 font-semibold rounded-xl border border-[#E8E9E9] hover:bg-primary-50 transition">
                List a Book
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary-600">How it works</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-stone-950 mt-3">Search, connect, and get the book</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
          {[
            { icon: 'las la-search', title: 'Find Books', text: 'Search by title, author, category, condition, and location.' },
            { icon: 'las la-comments', title: 'Message Sellers', text: 'Use Reshelved to ask questions and agree on the exchange.' },
            { icon: 'las la-sync', title: 'Sell, Swap, Donate', text: 'Choose the listing type that works for your book.' },
          ].map((item) => (
            <div key={item.title} className="bg-white border border-stone-200 rounded-3xl p-6 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
                <i className={`${item.icon} text-3xl`} />
              </div>
              <h3 className="text-xl font-bold text-stone-900 mt-5">{item.title}</h3>
              <p className="text-stone-600 mt-2">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary-600">Latest listings</p>
            <h2 className="text-3xl font-bold text-stone-950 mt-2">Books available now</h2>
          </div>
          <Link to="/browse" className="hidden sm:inline-flex text-primary-600 font-semibold hover:text-primary-700">View all books</Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-stone-200 overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-stone-200" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-stone-200 rounded w-3/4" />
                  <div className="h-3 bg-stone-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-3xl p-8 text-center">
            <i className="las la-book-open text-6xl text-stone-300" />
            <h3 className="text-lg font-bold text-stone-800 mt-3">No books listed yet</h3>
            <p className="text-stone-500 mt-1">Be the first to publish a listing.</p>
            <Link to="/create" className="mt-4 inline-flex px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition">List a Book</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
            {listings.map((listing) => <BookCard key={listing.id} listing={listing} />)}
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;
