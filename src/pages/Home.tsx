import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import BookCard from '../components/BookCard';
import type { Listing } from '../types';

const publisherLogos = [
  { name: 'Penguin Random House', src: '/publishers/penguin-random-house-logo.svg' },
  { name: 'Epsilon', src: '/publishers/epsilon.png' },
  { name: 'Longhorn', src: '/publishers/longhorn.png' },
  { name: 'Harper Collins', src: '/publishers/harper-collins.avif' },
  { name: 'Oxford Press', src: '/publishers/oxford-press.svg' },
  { name: 'Thames & Hudson', src: '/publishers/thames-hudson.png' }
];

const solutionItems = [
  { icon: 'la-book-open', text: 'Find the right book without the long search or stress.' },
  { icon: 'la-sync-alt', text: 'Swap old books and feel happy they matter again.' },
  { icon: 'la-wallet', text: 'Save more money while still getting books you love.' },
  { icon: 'la-check-circle', text: 'Meet trusted readers and trade with peace of mind.' }
];

const bookCategoryCards = [
  { title: 'Fiction', image: '/category-fiction.svg', fallback: '📖', href: '/browse?category=Fiction' },
  { title: 'Fantasy', image: '/category-fantasy.svg', fallback: '🧙', href: '/browse?category=Fantasy' },
  { title: 'Children', image: '/category-children.svg', fallback: '🧸', href: '/browse?category=Children' },
  { title: 'Business', image: '/category-business.svg', fallback: '💼', href: '/browse?category=Business%20%26%20Economics' },
  { title: 'Self-Help', image: '/category-self-help.svg', fallback: '🌱', href: '/browse?category=Self-Help' }
];

const testimonials = [
  { stars: 5, text: 'Finding affordable novels in Nairobi is genuinely hard. I stumbled on Reshelved looking for something to read over the weekend and ended up swapping two books I had already finished. The person I swapped with was lovely and we even recommended titles to each other. I keep coming back.', name: 'Amina Waweru', location: 'Kileleshwa, Nairobi', image: '/reviewer-1.png' },
  { stars: 5, text: 'I had three textbooks sitting on my shelf gathering dust after finishing uni. Listed them on Reshelved and within two days someone from Kasarani had already reached out. The messaging was simple and we sorted everything out quickly. Did not expect it to be this easy.', name: 'Brian Otieno', location: 'Kasarani, Nairobi', image: '/reviewer-2.png' },
  { stars: 5, text: "I donated a whole stack of children's books my kids had outgrown and the response was almost immediate. Knowing they went to a family nearby instead of a box somewhere felt really good. The platform is clean and signing up took me less than a minute. Would tell every parent in Nairobi about this.", name: 'Faith Ndegwa', location: 'South B, Nairobi', image: '/reviewer-3.png' }
];

const Home: React.FC = () => {
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchListings(); }, []);

  const fetchListings = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, 'listings'));
      const items: Listing[] = [];
      snap.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as Listing));
      items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setAllListings(items.filter((item) => item.active && item.expiresAt > Date.now()));
    } catch (err) {
      console.error('Error fetching listings:', err);
    } finally {
      setLoading(false);
    }
  };

  const latestListings = allListings.slice(0, 4);
  const liveSearchTerm = search.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!liveSearchTerm) return [];
    return allListings.filter((listing) => (
      listing.title.toLowerCase().includes(liveSearchTerm) || listing.author.toLowerCase().includes(liveSearchTerm) || listing.description.toLowerCase().includes(liveSearchTerm) || listing.category.toLowerCase().includes(liveSearchTerm) || listing.condition.toLowerCase().includes(liveSearchTerm) || listing.location.toLowerCase().includes(liveSearchTerm) || listing.type.toLowerCase().includes(liveSearchTerm)
    ));
  }, [allListings, liveSearchTerm]);

  const showingSearch = liveSearchTerm.length > 0;
  const visibleListings = showingSearch ? searchResults : latestListings;

  return (
    <div className="min-h-screen bg-white">
      <section className="relative bg-[#121212] bg-[url('/woman%20reading%20hero%20image.webp')] bg-cover bg-center bg-no-repeat text-white"><div className="absolute inset-0 bg-black/45" /><div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-[116px] sm:pt-32 sm:pb-[148px]"><div className="max-w-3xl"><h1 className="text-5xl sm:text-7xl font-bold leading-[1.08] tracking-tight">Reshelved Finds The Books You Need Without Overpaying</h1><p className="mt-8 text-xl text-white/85 leading-relaxed max-w-2xl">Reshelved helps you find affordable physical books by title, author, genre, condition, and location in one simple platform.</p><div className="mt-9 flex flex-wrap gap-3"><Link to="/browse" className="inline-flex items-center justify-center px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-md transition">Start Finding Books</Link><Link to="/create" className="inline-flex items-center justify-center px-5 py-3 text-white font-semibold rounded-md border border-white/70 hover:bg-white hover:text-stone-950 transition">List a Book <i className="las la-angle-right ml-1" /></Link></div></div></div></section>
      <section className="relative -mt-[60px] bg-white rounded-t-[42px] sm:rounded-t-[56px] pt-12 pb-0"><div className="max-w-7xl mx-auto px-4 sm:px-6"><div className="flex flex-col lg:flex-row gap-4 items-stretch"><div className="flex-1 relative"><i className="las la-search absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-stone-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search across 500+ books..." className="w-full h-12 pl-12 pr-4 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10" /></div>{showingSearch && <button type="button" onClick={() => setSearch('')} className="inline-flex items-center justify-center px-8 py-3 rounded-lg border border-stone-200 text-stone-700 text-sm font-bold transition hover:bg-stone-50 self-start lg:self-auto">Clear</button>}</div><div className="mt-10 flex items-center justify-between"><h2 className="text-2xl font-bold text-stone-950">{showingSearch ? `Search results for “${search.trim()}”` : 'Latest Books'}</h2>{!showingSearch && <Link to="/browse" className="text-sm font-semibold text-primary-600 hover:text-primary-700">View all</Link>}</div>{loading ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-6">{[...Array(4)].map((_, i) => <div key={i} className="rounded-2xl border border-stone-200 overflow-hidden animate-pulse bg-white"><div className="aspect-[4/3] bg-stone-200" /><div className="p-4 space-y-3"><div className="h-4 bg-stone-200 rounded w-3/4" /><div className="h-3 bg-stone-100 rounded w-1/2" /></div></div>)}</div> : visibleListings.length > 0 ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-6">{visibleListings.map((listing) => <BookCard key={listing.id} listing={listing} />)}</div> : showingSearch ? <div className="mt-6 rounded-3xl border border-stone-200 bg-stone-50 px-6 py-12 text-center"><i className="las la-search text-6xl text-stone-300" /><h3 className="mt-3 text-xl font-bold text-stone-900">We didn't find what you are looking for. Try another search</h3></div> : <div className="mt-6 rounded-3xl border border-stone-200 bg-stone-50 px-6 py-12 text-center"><i className="las la-book-open text-6xl text-stone-300" /><h3 className="mt-3 text-xl font-bold text-stone-900">No books listed yet</h3><p className="mt-2 text-stone-500">Once users publish books, the latest listings will appear here automatically.</p><Link to="/create" className="mt-5 inline-flex px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-md transition">List the first book</Link></div>}<div className="mt-20 pb-4"><div className="hidden sm:grid grid-cols-3 lg:grid-cols-6 gap-5 items-center">{publisherLogos.map((publisher) => <div key={publisher.name} className="h-20 flex items-center justify-center px-5"><img src={publisher.src} alt={`${publisher.name} logo`} className="max-h-12 max-w-[130px] object-contain" loading="lazy" /></div>)}</div><div className="sm:hidden relative overflow-hidden"><div className="flex w-max animate-[publisher-scroll_22s_linear_infinite]">{[...publisherLogos, ...publisherLogos].map((publisher, index) => <div key={`${publisher.name}-${index}`} className="mx-2 h-20 w-40 shrink-0 flex items-center justify-center px-4"><img src={publisher.src} alt={`${publisher.name} logo`} className="max-h-10 max-w-[120px] object-contain" loading="lazy" /></div>)}</div></div></div><p className="text-center text-xs font-semibold text-stone-400 mt-3">Collections from Top Publishers</p><div className="mt-4 border-b border-stone-200" /></div></section>
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-24"><div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center"><div className="max-w-xl"><h2 className="text-4xl sm:text-5xl font-bold text-stone-950 leading-tight">Book Hunting Should Not Be This Hard</h2><p className="mt-8 text-stone-600 leading-relaxed">The book you need is probably sitting on someone’s shelf right now. But finding it means asking around, scrolling through old posts, comparing prices, and hoping you do not get ignored or overcharged.</p><Link to="/browse" className="mt-8 inline-flex px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-md transition">Start Finding Books</Link></div><div className="relative min-h-[360px] lg:min-h-[420px] flex items-center justify-center"><img src="/home-pain-points-composition.svg" alt="Book hunting pain points: sellers feel risky, hard to find titles, and new books cost too much" className="w-full max-w-[560px] h-auto object-contain" loading="lazy" /></div></div></section>
      <section className="bg-white pt-5 pb-20"><div className="max-w-7xl mx-auto px-4 sm:px-6"><div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start"><div><h2 className="text-4xl sm:text-6xl font-bold leading-[1.05] tracking-tight text-stone-950 max-w-xl">Second-hand books should feel easy, safe, and worth it.</h2></div><div className="space-y-0">{solutionItems.map((item, index) => <div key={item.text} className={`flex items-center gap-6 py-7 ${index !== solutionItems.length - 1 ? 'border-b border-stone-200' : ''}`}><div className="w-16 h-16 rounded-full bg-[#FFF4E2] flex items-center justify-center shrink-0"><i className={`las ${item.icon} text-primary-600 text-3xl`} /></div><p className="text-[18px] font-normal leading-[1.45] text-stone-950">{item.text}</p></div>)}</div></div></div></section>
      <section className="bg-white pt-0 pb-16"><div className="max-w-7xl mx-auto px-4 sm:px-6"><picture className="block w-full"><source media="(max-width: 767px)" srcSet="/homepage%20personas%20active%20mobile.webp" /><img src="/homepage%20personas%20active.webp" alt="Different types of Reshelved readers and book traders" className="block h-auto w-full max-w-full object-contain" loading="lazy" /></picture></div></section>
      <section className="bg-white pt-10 sm:pt-16 pb-[220px] sm:pb-[340px]"><div className="relative max-w-7xl mx-auto px-4 sm:px-6"><div className="text-center max-w-3xl mx-auto"><h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-950">Find your next read faster</h2></div><div className="relative mt-10 -mx-4 sm:mx-0"><div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-white/55 via-white/30 to-transparent sm:hidden" /><div className="pointer-events-none absolute right-4 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-stone-700/95 text-white shadow-lg sm:hidden"><i className="las la-angle-right text-2xl" /></div><div className="flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5">{bookCategoryCards.map((category) => <Link key={category.title} to={category.href} className="group w-[calc((100vw-64px)/2.5)] min-w-[calc((100vw-64px)/2.5)] rounded-[22px] border border-stone-200 bg-white p-4 min-h-[180px] flex flex-col justify-between hover:-translate-y-1 hover:shadow-xl hover:border-[#1665CC] transition-all duration-300 sm:w-auto sm:min-w-0 sm:p-5 sm:min-h-[190px]"><h3 className="text-[19px] sm:text-[21px] leading-tight font-semibold text-stone-900">{category.title}</h3><div className="mt-4 flex items-center justify-center"><div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center"><img src={category.image} alt="" className="h-[60px] w-auto max-w-full object-contain" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; const fallback = event.currentTarget.nextElementSibling as HTMLElement | null; if (fallback) fallback.style.opacity = '1'; }} /><span className="absolute flex h-[60px] w-auto items-center justify-center text-[60px] leading-none opacity-0 transition">{category.fallback}</span></div></div></Link>)}</div></div></div></section>
      <section className="relative bg-[#121212] text-white pt-0 pb-0"><div className="max-w-5xl mx-auto px-4 sm:px-6 -translate-y-1/2 mb-[-90px] sm:mb-[-120px] relative z-10"><div className="bg-[#FFF4E2] text-stone-950 rounded-[28px] sm:rounded-[36px] px-6 sm:px-16 py-16 sm:py-24 text-center"><h2 className="text-4xl sm:text-6xl font-bold leading-tight">Don’t let your books sit unused</h2><p className="mt-8 text-stone-700">Someone needs what you already have.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Link to="/create" className="px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-md transition">List a Book</Link><Link to="/browse" className="px-5 py-3 border border-stone-900 text-stone-900 font-semibold rounded-md hover:bg-stone-900 hover:text-white transition">Find Books</Link></div><p className="mt-3 text-xs text-stone-500">Quick Sign Up | It’s 100% Free!</p></div></div><div className="max-w-7xl mx-auto px-4 sm:px-6 pb-0 pt-0"><div className="text-center"><p className="text-xs font-bold tracking-[0.25em] text-white uppercase mb-4">LOVED ACROSS NAIROBI</p><h2 className="text-4xl sm:text-6xl font-bold">See what others say</h2></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">{testimonials.map((review, i) => <div key={i} className="bg-white rounded-2xl border border-stone-200 p-6 flex flex-col gap-4"><div className="flex items-center gap-0.5">{[...Array(review.stars)].map((_, s) => <svg key={s} className="w-5 h-5 text-accent-500" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>)}</div><p className="text-[17px] leading-[1.4] text-black flex-1">“{review.text}”</p><div className="flex items-center gap-3 pt-2"><img src={review.image} alt={review.name} className="w-10 h-10 rounded-full object-cover bg-stone-200" loading="lazy" /><div><p className="font-semibold text-stone-800 text-sm">{review.name}</p><p className="text-[#898A88] text-xs mt-0.5">{review.location}</p></div></div></div>)}</div><div className="border-b border-white/25 pb-20 mt-28"><div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-12"><div className="text-[clamp(64px,11vw,140px)] font-bold leading-[0.92] tracking-tight text-white"><div>Start free</div><div className="inline-flex items-center gap-8"><span>today</span><Link to="/register" className="w-[clamp(72px,8vw,104px)] h-[clamp(72px,8vw,104px)] rounded-full bg-primary-600 hover:bg-primary-700 flex items-center justify-center transition shrink-0" aria-label="Join Reshelved free"><i className="las la-arrow-right text-[clamp(30px,3vw,44px)] text-white" /></Link></div></div><p className="text-white/80 text-lg max-w-md lg:pb-8">Built with feedback from readers across Nairobi. Try Reshelved and see why they love it.</p></div></div></div></section>
      <style>{`@keyframes publisher-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  );
};

export default Home;
