import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import BookCard from '../components/BookCard';
import type { Listing } from '../types';

const publisherPlaceholders = ['Publisher', 'Bookshop', 'Campus', 'Library', 'Reader', 'Vendor'];

const testimonials = [
  {
    stars: 5,
    text: 'Finding affordable novels in Nairobi is genuinely hard. I stumbled on Reshelved looking for something to read over the weekend and ended up swapping two books I had already finished. The person I swapped with was lovely and we even recommended titles to each other. I keep coming back.',
    name: 'Amina Waweru',
    location: 'Kileleshwa, Nairobi',
    image: '/reviewer-1.png'
  },
  {
    stars: 5,
    text: 'I had three textbooks sitting on my shelf gathering dust after finishing uni. Listed them on Reshelved and within two days someone from Kasarani had already reached out. The messaging was simple and we sorted everything out quickly. Did not expect it to be this easy.',
    name: 'Brian Otieno',
    location: 'Kasarani, Nairobi',
    image: '/reviewer-2.png'
  },
  {
    stars: 5,
    text: "I donated a whole stack of children's books my kids had outgrown and the response was almost immediate. Knowing they went to a family nearby instead of a box somewhere felt really good. The platform is clean and signing up took me less than a minute. Would tell every parent in Nairobi about this.",
    name: 'Fatuma Ndegwa',
    location: 'South B, Nairobi',
    image: '/reviewer-3.png'
  }
];

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
            <div className="mt-6 rounded-3xl border border-stone-200 bg-stone-50 px-6 py-12 text-center">
              <i className="las la-book-open text-6xl text-stone-300" />
              <h3 className="mt-3 text-xl font-bold text-stone-900">No books listed yet</h3>
              <p className="mt-2 text-stone-500">Once users publish books, the latest listings will appear here automatically.</p>
              <Link to="/create" className="mt-5 inline-flex px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-md transition">
                List the first book
              </Link>
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

      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-44">
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

      <section className="relative bg-black text-white pt-0 pb-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 -translate-y-1/2 mb-[-90px] sm:mb-[-120px] relative z-10">
          <div className="bg-[#f5eee3] text-stone-950 rounded-[28px] sm:rounded-[36px] px-6 sm:px-16 py-16 sm:py-24 text-center">
            <h2 className="text-4xl sm:text-6xl font-bold leading-tight">Don’t let your books sit unused</h2>
            <p className="mt-8 text-stone-700">Someone needs what you already have.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/create" className="px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-md transition">List a Book</Link>
              <Link to="/browse" className="px-5 py-3 border border-stone-900 text-stone-900 font-semibold rounded-md hover:bg-stone-900 hover:text-white transition">Find Books</Link>
            </div>
            <p className="mt-3 text-xs text-stone-500">Quick Sign Up | It’s 100% Free!</p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-28 pt-16">
          <div className="text-center">
            <p className="text-xs font-bold tracking-[0.25em] text-white uppercase mb-4">Testimonials</p>
            <h2 className="text-4xl sm:text-6xl font-bold">What others say</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
            {testimonials.map((review, i) => (
              <div key={i} className="bg-white rounded-2xl border border-stone-200 p-6 flex flex-col gap-4">
                <div className="flex items-center gap-0.5">
                  {[...Array(review.stars)].map((_, s) => (
                    <svg key={s} className="w-5 h-5 text-accent-500" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-[17px] leading-[1.4] text-black flex-1">“{review.text}”</p>
                <div className="flex items-center gap-3 pt-2">
                  <img src={review.image} alt={review.name} className="w-10 h-10 rounded-full object-cover bg-stone-200" loading="lazy" />
                  <div>
                    <p className="font-semibold text-stone-800 text-sm">{review.name}</p>
                    <p className="text-[#898A88] text-xs mt-0.5">{review.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-b border-white/25 pb-16 mt-28">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-12">
              <div className="text-[clamp(64px,11vw,140px)] font-bold leading-[0.92] tracking-tight text-white">
                <div>Start free</div>
                <div className="inline-flex items-center gap-8">
                  <span>today</span>
                  <Link to="/register" className="w-[clamp(72px,8vw,104px)] h-[clamp(72px,8vw,104px)] rounded-full bg-primary-600 hover:bg-primary-700 flex items-center justify-center transition shrink-0" aria-label="Join Reshelved free">
                    <i className="las la-arrow-right text-[clamp(30px,3vw,44px)] text-white" />
                  </Link>
                </div>
              </div>
              <p className="text-white/80 text-lg max-w-md lg:pb-8">
                Built with feedback from readers across Nairobi. Try Reshelved and see why they love it.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
