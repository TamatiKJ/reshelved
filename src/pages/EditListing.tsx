import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CATEGORIES, CONDITIONS, KENYAN_CITIES } from '../types';
import type { Listing } from '../types';
import ListingPreviewCard from '../components/listing-form/ListingPreviewCard';
import ListingStepper, { type ListingFormStep } from '../components/listing-form/ListingStepper';
import ListingImageCropModal from '../components/listing-form/ListingImageCropModal';
import { parseListingDoc, validateListingWrite } from '../services/listingValidation';

const MAX_IMAGES = 4;
const IMAGE_SIZE = 1400;
const STALL_TIMEOUT = 30000;
const fieldClass = 'w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-950 outline-none transition disabled:bg-stone-50 focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10';
const labelClass = 'mb-1.5 block text-sm font-bold text-stone-950';

type EditableImage = { id: string; url: string; file?: File; isNew?: boolean };
type CropState = { file: File; src: string; queue: File[]; zoom: number; x: number; y: number } | null;
type DragState = { startX: number; startY: number; cropX: number; cropY: number } | null;

const listingTypes = [
  { value: 'swap', label: 'Swap', icon: 'las la-sync', desc: 'Trade for another book' },
  { value: 'donate', label: 'Donate', icon: 'las la-gift', desc: 'Give away for free' },
  { value: 'sell', label: 'Sell', icon: 'las la-tag', desc: 'Set your price' }
] as const;

const steps: Array<{ id: ListingFormStep; label: string }> = [{ id: 1, label: 'Photos' }, { id: 2, label: 'Details' }, { id: 3, label: 'Preview' }];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const normalizeImages = (images?: unknown) => Array.isArray(images) ? images.filter((image): image is string => typeof image === 'string' && image.trim().length > 0) : [];

const loadImage = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Could not read this image. Try a JPG, PNG, or WebP file.'));
  image.src = src;
});

const cropListingImage = async (file: File, cropSrc: string, zoom: number, offsetX: number, offsetY: number): Promise<File> => {
  const image = await loadImage(cropSrc);
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_SIZE;
  canvas.height = IMAGE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image processing is not supported in this browser.');
  ctx.fillStyle = '#f5f5f4';
  ctx.fillRect(0, 0, IMAGE_SIZE, IMAGE_SIZE);
  const baseScale = Math.min(IMAGE_SIZE / image.naturalWidth, IMAGE_SIZE / image.naturalHeight);
  const drawWidth = image.naturalWidth * baseScale * zoom;
  const drawHeight = image.naturalHeight * baseScale * zoom;
  const dx = (IMAGE_SIZE - drawWidth) / 2 + (offsetX / 100) * Math.max(0, (drawWidth - IMAGE_SIZE) / 2);
  const dy = (IMAGE_SIZE - drawHeight) / 2 + (offsetY / 100) * Math.max(0, (drawHeight - IMAGE_SIZE) / 2);
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Could not convert image.')), 'image/webp', 0.84));
  const safeName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '-');
  return new File([blob], `${safeName}-cropped.webp`, { type: 'image/webp' });
};

const EditListing: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentUser, userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [step, setStep] = useState<ListingFormStep>(1);
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
  const [editableImages, setEditableImages] = useState<EditableImage[]>([]);
  const [cropState, setCropState] = useState<CropState>(null);
  const [dragState, setDragState] = useState<DragState>(null);
  const [uploadProgress, setUploadProgress] = useState({ active: false, currentFile: 0, totalFiles: 0, percent: 0, fileName: '' });

  const canEditListing = (item: Listing) => Boolean(currentUser && (item.userId === currentUser.uid || userProfile?.isAdmin));
  const canAddMoreImages = editableImages.length < MAX_IMAGES;
  const filesToUpload = useMemo(() => editableImages.filter((image) => image.file), [editableImages]);
  const previewImage = editableImages[0]?.url || normalizeImages(listing?.images)[0] || '';
  const previewTitle = title.trim() || listing?.title || 'Untitled book';
  const previewAuthor = author.trim() || listing?.author || 'Unknown author';
  const previewPrice = type === 'sell' ? `KSh ${price || listing?.price || 0}` : type === 'donate' ? 'Free' : 'Swap';

  const validatePhotos = () => editableImages.length < 1 ? 'A listing needs at least one image.' : '';
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
      if (!id || !currentUser) { setError('You must be logged in to edit a listing.'); setLoading(false); return; }
      setLoading(true); setError('');
      try {
        const snap = await getDoc(doc(db, 'listings', id));
        if (!snap.exists()) { setError('Listing not found.'); setListing(null); return; }
        const data = parseListingDoc(snap);
        if (!data) { setError('This listing has invalid data and cannot be edited safely.'); setListing(null); return; }
        if (!canEditListing(data)) { setError('You can only edit your own listings. Only admins can edit all listings.'); setListing(null); return; }
        setListing(data);
        setTitle(data.title || ''); setAuthor(data.author || ''); setDescription(data.description || ''); setCondition(data.condition || 'Good');
        setCategory(data.category || CATEGORIES[0]); setType(data.type || 'swap'); setPrice(data.price ? String(data.price) : ''); setLocation(data.location || 'Lavington');
        setEditableImages(normalizeImages(data.images).map((url) => ({ id: url, url })));
      } catch (err: any) { setError(err?.message || 'Could not load this listing.'); setListing(null); }
      finally { setLoading(false); }
    };
    fetchListing();
  }, [id, currentUser?.uid, userProfile?.isAdmin, authLoading]);

  const goToStep = (targetStep: ListingFormStep) => {
    const stepError = getStepError(targetStep);
    if (targetStep > step && stepError) { setError(stepError); return; }
    setError(''); setStep(targetStep);
  };
  const handleNext = () => goToStep(step === 1 ? 2 : 3);

  const openCropEditor = (file: File, queue: File[]) => {
    const reader = new FileReader();
    reader.onloadend = () => { setCropState({ file, queue, src: reader.result as string, zoom: 1, x: 0, y: 0 }); setDragState(null); };
    reader.readAsDataURL(file);
  };
  const closeCropEditor = () => { setCropState(null); setDragState(null); };
  const skipCrop = () => {
    if (!cropState) return;
    const [nextFile, ...remainingFiles] = cropState.queue;
    if (nextFile) openCropEditor(nextFile, remainingFiles); else closeCropEditor();
  };
  const resetCrop = () => setCropState((current) => current ? { ...current, zoom: 1, x: 0, y: 0 } : current);
  const handleCropPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!cropState) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({ startX: event.clientX, startY: event.clientY, cropX: cropState.x, cropY: cropState.y });
  };
  const handleCropPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState) return;
    const nextX = dragState.cropX + (event.clientX - dragState.startX) / 2.4;
    const nextY = dragState.cropY + (event.clientY - dragState.startY) / 2.4;
    setCropState((current) => current ? { ...current, x: clamp(nextX, -100, 100), y: clamp(nextY, -100, 100) } : current);
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = '';
    const availableSlots = MAX_IMAGES - editableImages.length;
    if (selectedFiles.length > availableSlots) { setError(`You can only add ${availableSlots} more image${availableSlots === 1 ? '' : 's'}.`); return; }
    const validFiles = selectedFiles.filter((file) => file.type.startsWith('image/') && file.size < 5 * 1024 * 1024);
    if (validFiles.length !== selectedFiles.length) setError('Some files were skipped. Images must be under 5MB.');
    if (!validFiles.length) return;
    const [firstFile, ...remainingFiles] = validFiles;
    openCropEditor(firstFile, remainingFiles);
  };

  const addCroppedImage = async () => {
    if (!cropState) return;
    try {
      const croppedFile = await cropListingImage(cropState.file, cropState.src, cropState.zoom, cropState.x, cropState.y);
      const previewUrl = URL.createObjectURL(croppedFile);
      setEditableImages((current) => [...current, { id: `${Date.now()}-${croppedFile.name}`, url: previewUrl, file: croppedFile, isNew: true }]);
      const [nextFile, ...remainingFiles] = cropState.queue;
      if (nextFile && editableImages.length + 1 < MAX_IMAGES) openCropEditor(nextFile, remainingFiles); else closeCropEditor();
      setError('');
    } catch (err: any) { setError(err?.message || 'Could not crop this image.'); }
  };

  const removeImage = (imageId: string) => setEditableImages((current) => {
    const target = current.find((image) => image.id === imageId);
    if (target?.url.startsWith('blob:')) URL.revokeObjectURL(target.url);
    return current.filter((image) => image.id !== imageId);
  });

  const uploadImageFile = async (file: File, listingId: string, index: number, totalFiles: number) => {
    if (!currentUser) throw new Error('You must be logged in to upload images.');
    const safeFileName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '-');
    const storageRef = ref(storage, `listings/${currentUser.uid}/${listingId}_${Date.now()}_${safeFileName}.webp`);
    const task = uploadBytesResumable(storageRef, file, { contentType: 'image/webp' });
    setUploadProgress({ active: true, currentFile: index + 1, totalFiles, percent: 0, fileName: file.name });
    return new Promise<string>((resolve, reject) => {
      let movedBytes = false;
      const stallTimer = window.setTimeout(() => { if (!movedBytes) { task.cancel(); reject(new Error('Image upload did not start. Check your internet connection and Firebase Storage rules.')); } }, STALL_TIMEOUT);
      task.on('state_changed', (snapshot) => {
        if (snapshot.bytesTransferred > 0) movedBytes = true;
        const percent = snapshot.totalBytes ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) : 0;
        setUploadProgress({ active: true, currentFile: index + 1, totalFiles, percent, fileName: file.name });
      }, (uploadError) => { window.clearTimeout(stallTimer); reject(uploadError); }, async () => { window.clearTimeout(stallTimer); resolve(await getDownloadURL(task.snapshot.ref)); });
    });
  };

  const uploadEditedImages = async (listingId: string) => {
    const uploadedNewImages = new Map<string, string>();
    for (let i = 0; i < filesToUpload.length; i += 1) uploadedNewImages.set(filesToUpload[i].id, await uploadImageFile(filesToUpload[i].file!, listingId, i, filesToUpload.length));
    return editableImages.map((image) => uploadedNewImages.get(image.id) || image.url).filter((url) => !url.startsWith('blob:'));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!listing || !currentUser) return;
    const finalError = validatePhotos() || validateDetails();
    if (finalError) { setError(finalError); setStep(validatePhotos() ? 1 : 2); return; }
    if (!canEditListing(listing)) { setError('You can only edit your own listings. Only admins can edit all listings.'); return; }
    setSaving(true); setError('');
    try {
      const imageUrls = await uploadEditedImages(listing.id);
      const mergedPayload = validateListingWrite({ ...listing, title: title.trim(), author: author.trim(), description: description.trim(), condition, category, type, price: type === 'sell' ? parseFloat(price) || 0 : 0, location, images: imageUrls, updatedAt: Date.now() });
      await updateDoc(doc(db, 'listings', listing.id), { title: mergedPayload.title, author: mergedPayload.author, description: mergedPayload.description, condition: mergedPayload.condition, category: mergedPayload.category, type: mergedPayload.type, price: mergedPayload.price || 0, location: mergedPayload.location, images: mergedPayload.images, updatedAt: Date.now() });
      navigate(`/listing/${listing.id}`);
    } catch (err: any) { setError(err?.message || 'Could not save listing. Check your Firestore rules.'); setSaving(false); setUploadProgress({ active: false, currentFile: 0, totalFiles: 0, percent: 0, fileName: '' }); }
  };

  if (loading || authLoading) return <div className="bg-[#F7F7F5] px-4 py-8 sm:px-6 lg:py-10"><div className="mx-auto max-w-[1180px] rounded-2xl border border-stone-200 bg-white p-8 text-stone-500">Loading listing editor...</div></div>;
  if (error && !listing) return <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6"><h1 className="text-xl font-bold text-stone-900">{error}</h1><div className="mt-4 flex items-center justify-center gap-4"><Link to="/profile" className="font-semibold text-primary-600">Back to profile</Link><Link to="/browse" className="font-semibold text-stone-600">Browse books</Link></div></div>;

  return (
    <div className="bg-[#F7F7F5] px-4 py-8 sm:px-6 lg:py-10">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-4xl font-bold tracking-tight text-stone-950 sm:text-5xl">Edit Listing</h1><p className="mt-2 text-base leading-7 text-stone-500">Update the photos and details buyers see.</p></div>{listing && <Link to={`/listing/${listing.id}`} className="text-sm font-bold text-primary-600 hover:text-primary-700">Cancel and Exit</Link>}</div>
        <form onSubmit={handleSave} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="min-w-0 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <ListingStepper steps={steps} activeStep={step} disabled={saving} canAccessStep={canAccessStep} onStepChange={goToStep} />
            {error && <div className="mx-4 mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            {uploadProgress.active && <div className="mx-4 mb-4 rounded-xl border border-green-200 bg-green-50 p-4"><div className="flex items-center justify-between gap-3 text-sm"><p className="truncate font-semibold text-green-700">Uploading image {uploadProgress.currentFile} of {uploadProgress.totalFiles}: {uploadProgress.fileName}</p><span className="font-bold text-green-700">{uploadProgress.percent}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-green-600 transition-all duration-200" style={{ width: `${uploadProgress.percent}%` }} /></div></div>}
            <div className="p-4 sm:p-6 lg:p-8">
              {step === 1 && <div><h2 className="text-2xl font-bold text-stone-950">Photos</h2><p className="mt-1 text-sm leading-6 text-stone-500">Keep, remove, or add up to 4 listing photos. New uploads use the same crop editor as Create Listing.</p><div className="mt-6 grid gap-3 sm:grid-cols-[240px_1fr]">{canAddMoreImages && <label className={`flex min-h-[210px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-[#FAFAF9] text-center transition hover:border-primary-600 hover:bg-primary-50/40 ${saving ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}><i className="las la-plus text-6xl text-primary-600" /><span className="mt-2 text-base font-bold text-stone-950">Add photos</span><span className="mt-1 text-sm text-stone-500">or click to upload</span><input type="file" accept="image/*" multiple onChange={handleImageChange} disabled={saving} className="hidden" /></label>}<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{editableImages.map((image) => <div key={image.id} className="group relative aspect-square overflow-hidden rounded-2xl border border-stone-200 bg-stone-100"><img src={image.url} alt="" className="h-full w-full object-cover" /><button type="button" onClick={() => removeImage(image.id)} disabled={saving} className="absolute right-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-red-500 text-sm font-bold text-white opacity-0 transition group-hover:opacity-100 disabled:opacity-40">×</button>{image.isNew && <span className="absolute bottom-2 left-2 rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-bold text-white">New</span>}</div>)}{Array.from({ length: Math.max(0, MAX_IMAGES - editableImages.length) }).map((_, i) => <div key={`empty-${i}`} className="aspect-square rounded-2xl border border-stone-200 bg-white" />)}</div></div><p className="mt-3 text-xs leading-5 text-stone-500">Upload JPG, PNG, or WebP images up to 5MB each.</p><div className="mt-6"><button type="button" onClick={handleNext} disabled={saving} className="cursor-pointer rounded-lg bg-primary-600 px-8 py-3 text-sm font-bold text-white transition hover:bg-primary-700 disabled:opacity-50">Next Step</button></div></div>}
              {step === 2 && <div><h2 className="text-2xl font-bold text-stone-950">Book Details</h2><div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2"><div><label className={labelClass}>Book Title *</label><input value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving} className={fieldClass} /></div><div><label className={labelClass}>Author *</label><input value={author} onChange={(e) => setAuthor(e.target.value)} disabled={saving} className={fieldClass} /></div><div className="sm:col-span-2"><label className={labelClass}>Description *</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={saving} rows={4} className={`${fieldClass} resize-none`} /></div></div><h2 className="mt-8 text-2xl font-bold text-stone-950">Listing Type</h2><div className="mt-5 grid gap-3 sm:grid-cols-3">{listingTypes.map((item) => <button key={item.value} type="button" disabled={saving} onClick={() => setType(item.value)} className={`cursor-pointer rounded-2xl border p-4 text-left transition disabled:opacity-60 ${type === item.value ? 'border-primary-600 bg-primary-50/60 ring-1 ring-primary-600/10' : 'border-stone-200 bg-white hover:border-primary-600'}`}><i className={`${item.icon} text-3xl text-stone-950`} /><div className="mt-3 text-sm font-bold text-stone-950">{item.label}</div><div className="mt-1 text-xs leading-5 text-stone-500">{item.desc}</div></button>)}</div><div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3"><div><label className={labelClass}>Condition *</label><select value={condition} onChange={(e) => setCondition(e.target.value as Listing['condition'])} disabled={saving} className={`${fieldClass} pr-10`}>{CONDITIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div><label className={labelClass}>Category *</label><select value={category} onChange={(e) => setCategory(e.target.value)} disabled={saving} className={`${fieldClass} pr-10`}>{CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div><label className={labelClass}>Location *</label><select value={location} onChange={(e) => setLocation(e.target.value)} disabled={saving} className={`${fieldClass} pr-10`}>{KENYAN_CITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>{type === 'sell' && <div><label className={labelClass}>Price (KSh) *</label><input type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} disabled={saving} className={fieldClass} /></div>}</div><div className="mt-6 flex flex-wrap items-center gap-3"><button type="button" onClick={() => goToStep(1)} disabled={saving} className="cursor-pointer rounded-lg border border-stone-200 px-8 py-3 text-sm font-bold text-stone-600 transition hover:bg-stone-50 disabled:opacity-50">Back</button><button type="button" onClick={handleNext} disabled={saving} className="cursor-pointer rounded-lg bg-primary-600 px-8 py-3 text-sm font-bold text-white transition hover:bg-primary-700 disabled:opacity-50">Next Step</button></div></div>}
              {step === 3 && <div><h2 className="text-2xl font-bold text-stone-950">Preview & Save</h2><p className="mt-1 text-sm leading-6 text-stone-500">Confirm the updated listing details before saving.</p><div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-5"><div className="grid gap-4 text-sm sm:grid-cols-2"><div><span className="font-bold text-stone-500">Title</span><p className="mt-1 font-bold text-stone-950">{previewTitle}</p></div><div><span className="font-bold text-stone-500">Author</span><p className="mt-1 text-stone-700">{previewAuthor}</p></div><div><span className="font-bold text-stone-500">Listing</span><p className="mt-1 text-stone-700">{listingTypes.find((item) => item.value === type)?.label}</p></div><div><span className="font-bold text-stone-500">Value</span><p className="mt-1 text-stone-700">{previewPrice}</p></div></div></div><div className="mt-6 flex flex-wrap items-center gap-3"><button type="button" onClick={() => goToStep(2)} disabled={saving} className="cursor-pointer rounded-lg border border-stone-200 px-8 py-3 text-sm font-bold text-stone-600 transition hover:bg-stone-50 disabled:opacity-50">Back</button><button type="submit" disabled={saving} className="cursor-pointer rounded-lg bg-primary-600 px-8 py-3 text-sm font-bold text-white transition hover:bg-primary-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button></div></div>}
            </div>
          </div>
          <ListingPreviewCard title={previewTitle} author={previewAuthor} imageUrl={previewImage} condition={condition} location={location} category={category} type={type} priceLabel={previewPrice} emptyImageLabel="Current cover will appear here" />
        </form>
      </div>
      {cropState && <ListingImageCropModal crop={{ src: cropState.src, zoom: cropState.zoom, x: cropState.x, y: cropState.y }} dragState={dragState} onDragStart={handleCropPointerDown} onDragMove={handleCropPointerMove} onDragEnd={() => setDragState(null)} onZoomChange={(zoom) => setCropState((current) => current ? { ...current, zoom } : current)} onReset={resetCrop} onSkip={skipCrop} onUsePhoto={addCroppedImage} />}
    </div>
  );
};

export default EditListing;
