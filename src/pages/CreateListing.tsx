import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CATEGORIES, KENYAN_CITIES, CONDITIONS } from '../types';
import type { Listing } from '../types';

const TEN_DAYS = 10 * 24 * 60 * 60 * 1000;

const listingTypes = [
  { value: 'swap', label: 'Swap', icon: 'las la-sync', desc: 'Trade for another book' },
  { value: 'donate', label: 'Donate', icon: 'las la-gift', desc: 'Give away for free' },
  { value: 'sell', label: 'Sell', icon: 'las la-tag', desc: 'Set your price' },
] as const;

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
  const [location, setLocation] = useState(userProfile?.location || 'Lavington');
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
    if (validFiles.length !== files.length) setError('Some files were skipped. Images must be under 5MB.');
    setImages(prev => [...prev, ...validFiles]);
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => setPreviews(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadListingImages = async (listingId: string, files: File[]) => {
    if (!currentUser || files.length === 0) return;
    try {
      const imageUrls: string[] = [];
      for (const file of files) {
        const storageRef = ref(storage, `listings/${currentUser.uid}/${listingId}_${Date.now()}_${file.name}`);
        const snap = await uploadBytes(storageRef, file);
        imageUrls.push(await getDownloadURL(snap.ref));
      }
      await updateDoc(doc(db, 'listings', listingId), { images: imageUrls });
    } catch (err) {
      console.error('Image upload failed after publishing listing:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile) return;
    setError('');
    setLoading(true);

    try {
      const now = Date.now();
      const docRef = await addDoc(collection(db, 'listings'), {
        title,
        author,
        description,
        condition,
        category,
        type,
        price: type === 'sell' ? parseFloat(price) || 0 : null,
        images: [],
        imageUploadPending: images.length > 0,
        userId: currentUser.uid,
        userName: userProfile.displayName,
        userPhoto: userProfile.photoURL || '',
        location,
        createdAt: now,
        expiresAt: now + TEN_DAYS,
        active: true,
        flagged: false,
        flagCount: 0
      });

      const filesToUpload = [...images];
      navigate('/browse');
      uploadListingImages(docRef.id, filesToUpload);
    } catch (err: any) {
      setError(err.message || 'Failed to create listing');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-stone-800">List a Book</h1>
      <p className="text-stone-500 mt-1">Share your book with the Reshelved community</p>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 sm:p-8 mt-6">
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Photos (up to 4)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {previews.map((preview, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-stone-200 group">
                  <img src={preview} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeImage(i)} className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-xs">×</button>
                </div>
              ))}
              {previews.length < 4 && (
                <label className="aspect-square rounded-xl border-2 border-dashed border-stone-300 hover:border-primary-400 flex flex-col items-center justify-center cursor-pointer transition hover:bg-primary-50">
                  <i className="las la-plus text-3xl text-stone-400" />
                  <span className="text-xs text-stone-500 mt-1">Add Photo</span>
                  <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
                </label>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Book Title *</label>
              <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition text-sm" placeholder="e.g. Things Fall Apart" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Author *</label>
              <input type="text" required value={author} onChange={(e) => setAuthor(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition text-sm" placeholder="e.g. Chinua Achebe" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition text-sm resize-none" placeholder="Tell us about the book condition, edition, and notes." />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Listing Type *</label>
            <div className="grid grid-cols-3 gap-3">
              {listingTypes.map((t) => (
                <button key={t.value} type="button" onClick={() => setType(t.value)} className={`p-3 rounded-xl border-2 text-center transition ${type === t.value ? 'border-primary-500 bg-primary-50' : 'border-stone-200 hover:border-stone-300'}`}>
                  <i className={`${t.icon} text-3xl text-primary-600`} />
                  <div className="text-sm font-semibold text-stone-800 mt-1">{t.label}</div>
                  <div className="text-xs text-stone-500 mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {type === 'sell' && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Price (KSh) *</label>
              <input type="number" required min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition text-sm" placeholder="e.g. 500" />
            </div>
          )}

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

          <div className="bg-accent-50 border border-accent-200 rounded-xl p-4 flex items-start gap-3">
            <i className="las la-info-circle text-2xl text-accent-600" />
            <div className="text-sm text-accent-800">
              <p className="font-medium">Your listing will publish immediately</p>
              <p className="text-accent-600 mt-0.5">It will show on the browse page and stay active for 10 days.</p>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? 'Publishing...' : 'Publish Listing'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateListing;
