import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CATEGORIES, CONDITIONS, KENYAN_CITIES } from '../types';
import type { Listing } from '../types';

const EditListing: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentUser, userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState<Listing['condition']>('Good');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [type, setType] = useState<Listing['type']>('swap');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('Lavington');

  const canEditListing = (item: Listing) => {
    return Boolean(currentUser && (item.userId === currentUser.uid || userProfile?.isAdmin));
  };

  useEffect(() => {
    const fetchListing = async () => {
      if (authLoading) return;
      if (!id || !currentUser) {
        setError('You must be logged in to edit a listing.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const snap = await getDoc(doc(db, 'listings', id));
        if (!snap.exists()) {
          setError('Listing not found.');
          setListing(null);
          return;
        }

        const data = { id: snap.id, ...snap.data() } as Listing;
        if (!canEditListing(data)) {
          setError('You can only edit your own listings. Only admins can edit all listings.');
          setListing(null);
          return;
        }

        setListing(data);
        setTitle(data.title || '');
        setAuthor(data.author || '');
        setDescription(data.description || '');
        setCondition(data.condition || 'Good');
        setCategory(data.category || CATEGORIES[0]);
        setType(data.type || 'swap');
        setPrice(data.price ? String(data.price) : '');
        setLocation(data.location || 'Lavington');
      } catch (err: any) {
        console.error('Error loading listing:', err);
        setError(err?.message || 'Could not load this listing.');
        setListing(null);
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [id, currentUser?.uid, userProfile?.isAdmin, authLoading]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!listing || !currentUser) return;

    if (!canEditListing(listing)) {
      setError('You can only edit your own listings. Only admins can edit all listings.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const updates = {
        title: title.trim(),
        author: author.trim(),
        description: description.trim(),
        condition,
        category,
        type,
        price: type === 'sell' ? parseFloat(price) || 0 : 0,
        location,
        updatedAt: Date.now()
      };

      if (!updates.title || !updates.author) {
        setError('Book title and author are required.');
        setSaving(false);
        return;
      }

      await updateDoc(doc(db, 'listings', listing.id), updates);
      navigate(`/listing/${listing.id}`);
    } catch (err: any) {
      console.error('Error saving listing:', err);
      setError(err?.message || 'Could not save listing. Check your Firestore rules.');
      setSaving(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-2xl border border-stone-200 p-8 animate-pulse">
          <div className="h-6 bg-stone-200 rounded w-1/2" />
          <div className="h-12 bg-stone-100 rounded mt-6" />
          <div className="h-12 bg-stone-100 rounded mt-4" />
        </div>
      </div>
    );
  }

  if (error && !listing) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h1 className="text-xl font-bold text-stone-900">{error}</h1>
        <div className="mt-4 flex items-center justify-center gap-4">
          <Link to="/profile" className="inline-flex text-primary-600 font-semibold">Back to profile</Link>
          <Link to="/browse" className="inline-flex text-stone-600 font-semibold">Browse books</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Edit Listing</h1>
          <p className="text-sm text-stone-500 mt-1">Update the book details buyers see.</p>
        </div>
        {listing && <Link to={`/listing/${listing.id}`} className="text-sm font-semibold text-primary-600 hover:text-primary-700">Cancel</Link>}
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 sm:p-8 space-y-5">
        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Book Title *</label>
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Author *</label>
            <input value={author} onChange={(event) => setAuthor(event.target.value)} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition text-sm resize-none" />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">Listing Type</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'swap', label: 'Swap', icon: 'las la-sync' },
              { value: 'donate', label: 'Donate', icon: 'las la-gift' },
              { value: 'sell', label: 'Sell', icon: 'las la-tag' }
            ].map((item) => (
              <button key={item.value} type="button" onClick={() => setType(item.value as Listing['type'])} className={`p-3 rounded-xl border-2 text-center transition ${type === item.value ? 'border-primary-500 bg-primary-50' : 'border-stone-200 hover:border-stone-300'}`}>
                <i className={`${item.icon} text-2xl text-primary-600`} />
                <div className="text-sm font-semibold text-stone-800 mt-1">{item.label}</div>
              </button>
            ))}
          </div>
        </div>

        {type === 'sell' && (
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Price (KSh)</label>
            <input type="number" min="0" value={price} onChange={(event) => setPrice(event.target.value)} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition text-sm" />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Condition</label>
            <select value={condition} onChange={(event) => setCondition(event.target.value as Listing['condition'])} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition text-sm bg-white">
              {CONDITIONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Category</label>
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition text-sm bg-white">
              {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Location</label>
            <select value={location} onChange={(event) => setLocation(event.target.value)} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition text-sm bg-white">
              {KENYAN_CITIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>

        <button type="submit" disabled={saving} className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
};

export default EditListing;
