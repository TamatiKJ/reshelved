import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CONDITIONS, KENYAN_CITIES } from '../types';
import type { Listing } from '../types';
import ListingPreviewCard from '../components/listing-form/ListingPreviewCard';
import ListingStepper, { type ListingFormStep } from '../components/listing-form/ListingStepper';
import { parseListingDoc, validateListingWrite } from '../services/listingValidation';
import { normalizeListingImageUrls } from '../services/listingImages';
import { useListingCategories } from '../hooks/useListingCategories';

const fieldClass = 'w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-950 outline-none transition disabled:bg-stone-50 focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10';
const labelClass = 'mb-1.5 block text-sm font-bold text-stone-950';

const listingTypes = [
  { value: 'swap', label: 'Swap', icon: 'las la-sync', desc: 'Trade for another book' },
  { value: 'donate', label: 'Donate', icon: 'las la-gift', desc: 'Give away for free' },
  { value: 'sell', label: 'Sell', icon: 'las la-tag', desc: 'Set your price' }
] as const;

const steps: Array<{ id: ListingFormStep; label: string }> = [
  { id: 1, label: 'Photos' },
  { id: 2, label: 'Details' },
  { id: 3, label: 'Preview' }
];

const EditListing: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentUser, userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { categories: listingCategories, loading: categoriesLoading } = useListingCategories();
  const [listing, setListing] = useState<Listing | null>(null);
  const [step, setStep] = useState<ListingFormStep>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState<Listing['condition']>('Good');
  const [category, setCategory] = useState('');
  const [type, setType] = useState<Listing['type']>('swap');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('Lavington');
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  const selectedCategory = useMemo(
    () => listingCategories.find((item) => item.name === category || item.id === category || item.slug === category),
    [listingCategories, category]
  );
  const previewImage = imageUrls[0] || '';
  const previewTitle = title.trim() || listing?.title || 'Untitled book';
  const previewAuthor = author.trim() || listing?.author || 'Unknown author';
  const previewPrice = type === 'sell' ? `KSh ${price || listing?.price || 0}` : type === 'donate' ? 'Free' : 'Swap';
  const previewCategory = selectedCategory?.name || category;

  const canEditListing = (item: Listing) => Boolean(currentUser && (item.userId === currentUser.uid || userProfile?.isAdmin));
  const validatePhotos = () => imageUrls.length < 1 ? 'A listing needs at least one image.' : '';
  const validateDetails = () => {
    if (!title.trim()) return 'Book title is required.';
    if (!author.trim()) return 'Author is required.';
    if (!description.trim()) return 'Description is required.';
    if (!category.trim()) return 'Category is required.';
    if (!location.trim()) return 'Location is required.';
    if (type === 'sell' && (!price.trim() || Number(price) <= 0)) return 'Add a valid price before saving.';
    return '';
  };
  const getStepError = (targetStep: ListingFormStep) => targetStep >= 3 ? validatePhotos() || validateDetails() : targetStep >= 2 ? validatePhotos() : '';
  const canAccessStep = (targetStep: ListingFormStep) => targetStep <= step || !getStepError(targetStep);

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
        const data = parseListingDoc(snap);
        if (!data) {
          setError('This listing has invalid data and cannot be edited safely.');
          setListing(null);
          return;
        }
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
        setCategory(data.categoryName || data.category || '');
        setType(data.type || 'swap');
        setPrice(data.price ? String(data.price) : '');
        setLocation(data.location || 'Lavington');
        setImageUrls(normalizeListingImageUrls(data.images));
      } catch (err: any) {
        setError(err?.message || 'Could not load this listing.');
        setListing(null);
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [id, currentUser?.uid, userProfile?.isAdmin, authLoading]);

  const goToStep = (targetStep: ListingFormStep) => {
    const stepError = getStepError(targetStep);
    if (targetStep > step && stepError) {
      setError(stepError);
      return;
    }
    setError('');
    setStep(targetStep);
  };

  const handleNext = () => goToStep(step === 1 ? 2 : 3);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!listing || !currentUser) return;

    const finalError = validatePhotos() || validateDetails();
    if (finalError) {
      setError(finalError);
      setStep(validatePhotos() ? 1 : 2);
      return;
    }
    if (!canEditListing(listing)) {
      setError('You can only edit your own listings. Only admins can edit all listings.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const categoryName = selectedCategory?.name || category;
      const mergedPayload = validateListingWrite({
        ...listing,
        title: title.trim(),
        author: author.trim(),
        description: description.trim(),
        condition,
        category: categoryName,
        categoryId: selectedCategory?.id || selectedCategory?.slug || categoryName,
        categoryName,
        type,
        price: type === 'sell' ? parseFloat(price) || 0 : 0,
        location,
        images: imageUrls,
        updatedAt: Date.now()
      });

      await updateDoc(doc(db, 'listings', listing.id), {
        title: mergedPayload.title,
        author: mergedPayload.author,
        description: mergedPayload.description,
        condition: mergedPayload.condition,
        category: categoryName,
        categoryId: selectedCategory?.id || selectedCategory?.slug || categoryName,
        categoryName,
        type: mergedPayload.type,
        price: mergedPayload.price || 0,
        location: mergedPayload.location,
        images: mergedPayload.images,
        updatedAt: Date.now()
      });

      navigate(`/listing/${listing.id}`);
    } catch (err: any) {
      setError(err?.message || 'Could not save listing. Check your Firestore rules.');
      setSaving(false);
    }
  };

  if (loading || authLoading) {
    return <div className="bg-[#F7F7F5] px-4 py-8 sm:px-6 lg:py-10"><div className="mx-auto max-w-[1180px] rounded-2xl border border-stone-200 bg-white p-8 text-stone-500">Loading listing editor...</div></div>;
  }

  if (error && !listing) {
    return <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6"><h1 className="text-xl font-bold text-stone-900">{error}</h1><div className="mt-4 flex items-center justify-center gap-4"><Link to="/profile" className="font-semibold text-primary-600">Back to profile</Link><Link to="/browse" className="font-semibold text-stone-600">Browse books</Link></div></div>;
  }

  return (
    <div className="bg-[#F7F7F5] px-4 py-8 sm:px-6 lg:py-10">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-stone-950 sm:text-5xl">Edit Listing</h1>
            <p className="mt-2 text-base leading-7 text-stone-500">Update the details buyers see.</p>
          </div>
          {listing && <Link to={`/listing/${listing.id}`} className="text-sm font-bold text-primary-600 hover:text-primary-700">Cancel and Exit</Link>}
        </div>

        <form onSubmit={handleSave} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="min-w-0 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <ListingStepper steps={steps} activeStep={step} disabled={saving} canAccessStep={canAccessStep} onStepChange={goToStep} />
            {error && <div className="mx-4 mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            <div className="p-4 sm:p-6 lg:p-8">
              {step === 1 && (
                <div>
                  <h2 className="text-2xl font-bold text-stone-950">Photos</h2>
                  <p className="mt-1 text-sm leading-6 text-stone-500">Current listing photos are preserved. Add or remove photos from the create listing flow if needed.</p>
                  <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {imageUrls.map((url) => (
                      <div key={url} className="aspect-square overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-6"><button type="button" onClick={handleNext} disabled={saving} className="cursor-pointer rounded-lg bg-primary-600 px-8 py-3 text-sm font-bold text-white transition hover:bg-primary-700 disabled:opacity-50">Next Step</button></div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h2 className="text-2xl font-bold text-stone-950">Book Details</h2>
                  <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div><label className={labelClass}>Book Title *</label><input value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving} className={fieldClass} /></div>
                    <div><label className={labelClass}>Author *</label><input value={author} onChange={(e) => setAuthor(e.target.value)} disabled={saving} className={fieldClass} /></div>
                    <div className="sm:col-span-2"><label className={labelClass}>Description *</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={saving} rows={4} className={`${fieldClass} resize-none`} /></div>
                  </div>

                  <h2 className="mt-8 text-2xl font-bold text-stone-950">Listing Type</h2>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {listingTypes.map((item) => <button key={item.value} type="button" disabled={saving} onClick={() => setType(item.value)} className={`cursor-pointer rounded-2xl border p-4 text-left transition disabled:opacity-60 ${type === item.value ? 'border-primary-600 bg-primary-50/60 ring-1 ring-primary-600/10' : 'border-stone-200 bg-white hover:border-primary-600'}`}><i className={`${item.icon} text-3xl text-stone-950`} /><div className="mt-3 text-sm font-bold text-stone-950">{item.label}</div><div className="mt-1 text-xs leading-5 text-stone-500">{item.desc}</div></button>)}
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
                    <div><label className={labelClass}>Condition *</label><select value={condition} onChange={(e) => setCondition(e.target.value as Listing['condition'])} disabled={saving} className={`${fieldClass} pr-10`}>{CONDITIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                    <div><label className={labelClass}>Category *</label><select value={category} onChange={(e) => setCategory(e.target.value)} disabled={saving || categoriesLoading} className={`${fieldClass} pr-10`}><option value="" disabled>{categoriesLoading ? 'Loading categories...' : 'Select category'}</option>{category && !selectedCategory && <option value={category}>{category}</option>}{listingCategories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></div>
                    <div><label className={labelClass}>Location *</label><select value={location} onChange={(e) => setLocation(e.target.value)} disabled={saving} className={`${fieldClass} pr-10`}>{KENYAN_CITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                    {type === 'sell' && <div><label className={labelClass}>Price (KSh) *</label><input type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} disabled={saving} className={fieldClass} /></div>}
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-3"><button type="button" onClick={() => goToStep(1)} disabled={saving} className="cursor-pointer rounded-lg border border-stone-200 px-8 py-3 text-sm font-bold text-stone-600 transition hover:bg-stone-50 disabled:opacity-50">Back</button><button type="button" onClick={handleNext} disabled={saving} className="cursor-pointer rounded-lg bg-primary-600 px-8 py-3 text-sm font-bold text-white transition hover:bg-primary-700 disabled:opacity-50">Next Step</button></div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <h2 className="text-2xl font-bold text-stone-950">Preview & Save</h2>
                  <p className="mt-1 text-sm leading-6 text-stone-500">Confirm the updated listing details before saving.</p>
                  <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-5"><div className="grid gap-4 text-sm sm:grid-cols-2"><div><span className="font-bold text-stone-500">Title</span><p className="mt-1 font-bold text-stone-950">{previewTitle}</p></div><div><span className="font-bold text-stone-500">Author</span><p className="mt-1 text-stone-700">{previewAuthor}</p></div><div><span className="font-bold text-stone-500">Listing</span><p className="mt-1 text-stone-700">{listingTypes.find((item) => item.value === type)?.label}</p></div><div><span className="font-bold text-stone-500">Value</span><p className="mt-1 text-stone-700">{previewPrice}</p></div></div></div>
                  <div className="mt-6 flex flex-wrap items-center gap-3"><button type="button" onClick={() => goToStep(2)} disabled={saving} className="cursor-pointer rounded-lg border border-stone-200 px-8 py-3 text-sm font-bold text-stone-600 transition hover:bg-stone-50 disabled:opacity-50">Back</button><button type="submit" disabled={saving} className="cursor-pointer rounded-lg bg-primary-600 px-8 py-3 text-sm font-bold text-white transition hover:bg-primary-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button></div>
                </div>
              )}
            </div>
          </div>

          <ListingPreviewCard title={previewTitle} author={previewAuthor} imageUrl={previewImage} condition={condition} location={location} category={previewCategory} type={type} priceLabel={previewPrice} emptyImageLabel="Current cover will appear here" />
        </form>
      </div>
    </div>
  );
};

export default EditListing;
