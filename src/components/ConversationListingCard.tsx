import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import type { Conversation, Listing } from '../types';

type ConversationListingCardProps = {
  conversation: Conversation;
};

const getTypeLabel = (type?: string) => {
  if (type === 'sell') return 'For Sale';
  if (type === 'swap') return 'Swap';
  if (type === 'donate') return 'Free / Donate';
  return 'Book listing';
};

const ConversationListingCard: React.FC<ConversationListingCardProps> = ({ conversation }) => {
  const [listing, setListing] = useState<Listing | null>(null);
  const [listingExists, setListingExists] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const loadListing = async () => {
      if (!conversation.listingId) return;
      setLoading(true);
      setListingExists(true);
      try {
        const snap = await getDoc(doc(db, 'listings', conversation.listingId));
        if (!active) return;
        if (snap.exists()) {
          setListing({ id: snap.id, ...snap.data() } as Listing);
          setListingExists(true);
        } else {
          setListing(null);
          setListingExists(false);
        }
      } catch (err) {
        console.error('Could not load conversation listing context:', err);
        if (active) setListingExists(false);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadListing();
    return () => { active = false; };
  }, [conversation.listingId]);

  const coverImage = useMemo(() => {
    if (listing?.images?.length) return listing.images[0];
    return conversation.listingImage || '';
  }, [listing?.images, conversation.listingImage]);

  const title = listing?.title || conversation.listingTitle || 'Book listing';
  const type = listing?.type || conversation.listingType;
  const price = typeof listing?.price === 'number' ? listing.price : conversation.listingPrice;
  const priceText = type === 'sell' && typeof price === 'number' ? `KSh ${price.toLocaleString()}` : getTypeLabel(type);
  const author = listing?.author ? `by ${listing.author}` : 'Started from this book listing';
  const isActive = Boolean(listingExists && listing?.active !== false && (!listing?.expiresAt || listing.expiresAt > Date.now()));
  const statusLabel = loading ? 'Checking...' : isActive ? 'Active' : 'Deleted';
  const statusClass = isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200';

  const cardContent = (
    <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 transition hover:border-[#1665CC] hover:shadow-sm">
      <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-stone-100">
        {coverImage ? <img src={coverImage} alt={title} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><i className="las la-book text-2xl text-stone-300" /></div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1665CC]">Chat about this book</p>
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${statusClass}`}>{statusLabel}</span>
        </div>
        <h4 className="mt-1 truncate text-sm font-bold text-stone-900">{loading ? 'Loading book details...' : title}</h4>
        <p className="mt-0.5 truncate text-xs text-stone-500">{author}</p>
      </div>
      <div className="hidden text-right sm:block">
        <span className="inline-flex rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700">{priceText}</span>
        <p className="mt-2 text-[11px] font-semibold text-stone-400">{isActive ? 'View listing' : 'Listing unavailable'}</p>
      </div>
      {isActive && <i className="las la-angle-right text-xl text-stone-400" />}
    </div>
  );

  return (
    <div className="border-b border-stone-200 bg-[#FFF4E2]/45 px-4 py-3">
      {isActive ? <Link to={`/listing/${conversation.listingId}`}>{cardContent}</Link> : cardContent}
    </div>
  );
};

export default ConversationListingCard;
