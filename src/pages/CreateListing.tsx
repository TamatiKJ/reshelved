import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CATEGORIES, KENYAN_CITIES, CONDITIONS } from '../types';
import type { Listing } from '../types';

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

const CreateListing: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState<Listing['condition']>('Good');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [type, setType] = useState<Listing['type']>('swap');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState(userProfile?.location || 'Nairobi');
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 4) {
      setError('Maximum 4 images allowed');
      return;
    }
    const validFiles = files.filter(f => f.type.startsWith('image/') && f.size < 5 * 1024 * 1024);
    if (validFiles.length !== files.length) {
      setError('Some files were skipped (must be images under 5MB)');
    }
    setImages(prev => [...prev, ...validFiles]);
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile) return;
    setError('');
    setLoading(true);

    try {
      // Upload images
      const imageUrls: string[] = [];
      for (const file of images) {
        const storageRef = ref(storage, `listings/${currentUser.uid}/${Date.now()}_${file.name}`);
        const snap = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snap.ref);
        imageUrls.push(url);
      }

      const now = Date.now();
      const listingData = {
        title,
        author,
        description,
        condition,
        category,
        type,
        price: type === 'sell' ? parseFloat(price) || 0 : null,
        images: imageUrls,
        userId: currentUser.uid,
        userName: userProfile.displayName,
        userPhoto: userProfile.photoURL || '',
        location,
        createdAt: now,
        expiresAt: now + SEVEN_DAYS,
        active: true,
        flagged: false,
        flagCount: 0
      };

      const docRef = await addDoc(collection(db, 'listings'), listingData);
      navigate(`/listing/${docRef.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create listing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-stone-800">List a Book</h1>
      <p className="text-stone-500 mt-1">Share your book with the Reshelved community</p>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 sm:p-8 mt-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Photos (up to 4)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {previews.map((preview, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-stone-200 group">
                  <img src={preview} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-xs"
                  >✕</button>
                </div>
              ))}
              {previews.length < 4 && (
                <label className="aspect-square rounded-xl border-2 border-dashed border-stone-300 hover:border-primary-400 flex flex-col items-center justify-center cursor-pointer transition hover:bg-primary-50">
                  <svg className="w-8 h-8 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
                  <span className="text-xs text-stone-500 mt-1">Add Photo</span>
                  <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
                </label>
              )}
            </div>
          </div>

          {/* Title & Author */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Book Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition text-sm"
                placeholder="e.g. Things Fall Apart"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Author *</label>
              <input
                type="text"
                required
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition text-sm"
                placeholder="e.g. Chinua Achebe"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition text-sm resize-none"
              placeholder="Tell us about the book's condition, edition, any notes..."
            />
          </div>

          {/* Type Selection */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Listing Type *</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'swap', label: 'Swap', icon: '🔄', desc: 'Trade for another book' },
                { value: 'donate', label: 'Donate', icon: '🎁', desc: 'Give away for free' },
                { value: 'sell', label: 'Sell', icon: '💰', desc: 'Set your price' },
              ].map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value as Listing['type'])}
                  className={`p-3 rounded-xl border-2 text-center transition ${type === t.value ? 'border-primary-500 bg-primary-50' : 'border-stone-200 hover:border-stone-300'}`}
                >
                  <div className="text-2xl mb-1">{t.icon}</div>
                  <div className="text-sm font-semibold text-stone-800">{t.label}</div>
                  <div className="text-xs text-stone-500 mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Price (sell only) */}
          {type === 'sell' && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Price (KSh) *</label>
              <input
                type="number"
                required
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition text-sm"
                placeholder="e.g. 500"
              />
            </div>
          )}

          {/* Condition, Category, Location */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Condition *</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value as Listing['condition'])} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition text-sm bg-white">
                {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Category *</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition text-sm bg-white">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Location *</label>
              <select value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition text-sm bg-white">
                {KENYAN_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Info box */}
          <div className="bg-accent-50 border border-accent-200 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-accent-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div className="text-sm text-accent-800">
              <p className="font-medium">Your listing will be active for 7 days</p>
              <p className="text-accent-600 mt-0.5">After that, it will automatically expire. You can relist it anytime.</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Uploading...
              </>
            ) : (
              'Publish Listing'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateListing;
