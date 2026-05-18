import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addDoc, collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CATEGORIES, CONDITIONS, KENYAN_CITIES } from '../types';
import type { Listing } from '../types';

const TEN_DAYS = 10 * 24 * 60 * 60 * 1000;
const MAX_IMAGES = 4;
const MAX_LISTING_IMAGE_SIZE = 1400;
const UPLOAD_STALL_TIMEOUT = 30000;
const focusFieldClass = 'focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10';
const inputClass = `w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 disabled:bg-stone-50 ${focusFieldClass}`;
const labelClass = 'mb-1.5 block text-sm font-bold text-stone-800';

const listingTypes = [
  { value: 'swap', label: 'Swap', icon: 'las la-sync', desc: 'Trade for another book' },
  { value: 'donate', label: 'Donate', icon: 'las la-gift', desc: 'Give away for free' },
  { value: 'sell', label: 'Sell', icon: 'las la-tag', desc: 'Set your price' }
] as const;

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const loadImage = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Could not read this image. Try a JPG, PNG, or WebP file.'));
  image.src = src;
});

const cropListingImage = async (file: File, cropSrc: string, zoom: number, offsetX: number, offsetY: number): Promise<File> => {
  const image = await loadImage(cropSrc);
  const size = MAX_LISTING_IMAGE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image processing is not supported in this browser.');

  ctx.fillStyle = '#f5f5f4';
  ctx.fillRect(0, 0, size, size);

  const baseScale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
  const drawWidth = image.naturalWidth * baseScale * zoom;
  const drawHeight = image.naturalHeight * baseScale * zoom;
  const maxMoveX = Math.max(0, (drawWidth - size) / 2);
  const maxMoveY = Math.max(0, (drawHeight - size) / 2);
  const dx = (size - drawWidth) / 2 + (offsetX / 100) * maxMoveX;
  const dy = (size - drawHeight) / 2 + (offsetY / 100) * maxMoveY;

  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Could not convert image to WebP.')), 'image/webp', 0.84);
  });

  const safeFileName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '-');
  return new File([blob], `${safeFileName}-cropped.webp`, { type: 'image/webp' });
};

const compressListingImage = async (file: File): Promise<Blob> => {
  if (file.type === 'image/webp' && file.name.endsWith('-cropped.webp')) return file;
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const ratio = Math.min(1, MAX_LISTING_IMAGE_SIZE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.round(image.naturalWidth * ratio);
    const height = Math.round(image.naturalHeight * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing is not supported in this browser.');
    ctx.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not convert image to WebP.')), 'image/webp', 0.82);
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const CreateListing: React.FC = () => {
  const { currentUser, userProfile, refreshProfile } = useAuth();
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
  const [cropQueue, setCropQueue] = useState<File[]>([]);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropSrc, setCropSrc] = useState('');
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [uploadProgress, setUploadProgress] = useState({ active: false, done: false, phase: '', fileName: '', currentFile: 0, totalFiles: 0, bytesTransferred: 0, totalBytes: 0, percent: 0 });

  const openCropEditor = (file: File, queue: File[]) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setCropFile(file);
      setCropQueue(queue);
      setCropSrc(reader.result as string);
      setCropZoom(1);
      setCropX(0);
      setCropY(0);
    };
    reader.readAsDataURL(file);
  };

  const closeCropEditor = () => {
    setCropFile(null);
    setCropSrc('');
    setCropQueue([]);
    setCropZoom(1);
    setCropX(0);
    setCropY(0);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    e.target.value = '';
    if (images.length + selectedFiles.length > MAX_IMAGES) {
      setError(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }
    const validFiles = selectedFiles.filter((file) => file.type.startsWith('image/') && file.size < 5 * 1024 * 1024);
    if (validFiles.length !== selectedFiles.length) setError('Some files were skipped. Images must be under 5MB.');
    if (validFiles.length === 0) return;
    const [firstFile, ...remainingFiles] = validFiles;
    openCropEditor(firstFile, remainingFiles);
  };

  const addCroppedImage = async () => {
    if (!cropFile || !cropSrc) return;
    try {
      const croppedFile = await cropListingImage(cropFile, cropSrc, cropZoom, cropX, cropY);
      const previewUrl = URL.createObjectURL(croppedFile);
      setImages((current) => [...current, croppedFile]);
      setPreviews((current) => [...current, previewUrl]);
      const [nextFile, ...remainingFiles] = cropQueue;
      if (nextFile && images.length + 1 < MAX_IMAGES) openCropEditor(nextFile, remainingFiles);
      else closeCropEditor();
    } catch (err: any) {
      setError(err?.message || 'Could not crop this image.');
    }
  };

  const skipCurrentCrop = () => {
    const [nextFile, ...remainingFiles] = cropQueue;
    if (nextFile) openCropEditor(nextFile, remainingFiles);
    else closeCropEditor();
  };

  const removeImage = (index: number) => {
    setImages((current) => current.filter((_, i) => i !== index));
    setPreviews((current) => {
      const removed = current[index];
      if (removed?.startsWith('blob:')) URL.revokeObjectURL(removed);
      return current.filter((_, i) => i !== index);
    });
  };

  const uploadSingleFile = async (listingId: string, file: File, index: number, totalFiles: number): Promise<string> => {
    if (!currentUser) throw new Error('You must be logged in to upload images.');
    setUploadProgress({ active: true, done: false, phase: 'Converting to WebP', fileName: file.name, currentFile: index + 1, totalFiles, bytesTransferred: 0, totalBytes: file.size, percent: 0 });
    const compressedBlob = await compressListingImage(file);
    const safeFileName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '-');
    const storageRef = ref(storage, `listings/${currentUser.uid}/${listingId}_${Date.now()}_${safeFileName}.webp`);
    const task = uploadBytesResumable(storageRef, compressedBlob, { contentType: 'image/webp' });

    return new Promise((resolve, reject) => {
      let movedBytes = false;
      const stallTimer = window.setTimeout(() => {
        if (!movedBytes) {
          task.cancel();
          reject(new Error('Image upload did not start. Check your internet connection and Firebase Storage rules.'));
        }
      }, UPLOAD_STALL_TIMEOUT);
      task.on('state_changed', (snapshot) => {
        if (snapshot.bytesTransferred > 0) movedBytes = true;
        const percent = snapshot.totalBytes ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) : 0;
        setUploadProgress({ active: true, done: false, phase: snapshot.state === 'paused' ? 'Upload paused' : 'Uploading image', fileName: file.name, currentFile: index + 1, totalFiles, bytesTransferred: snapshot.bytesTransferred, totalBytes: snapshot.totalBytes, percent });
      }, (uploadError) => {
        window.clearTimeout(stallTimer);
        reject(uploadError);
      }, async () => {
        window.clearTimeout(stallTimer);
        resolve(await getDownloadURL(task.snapshot.ref));
      });
    });
  };

  const uploadListingImages = async (listingId: string, files: File[]) => {
    const imageUrls: string[] = [];
    for (let i = 0; i < files.length; i += 1) imageUrls.push(await uploadSingleFile(listingId, files[i], i, files.length));
    await updateDoc(doc(db, 'listings', listingId), { images: imageUrls });
  };

  const syncDefaultLocationIfNeeded = async () => {
    if (!currentUser || !userProfile) return;
    if (userProfile.location?.trim()) return;
    await setDoc(doc(db, 'users', currentUser.uid), { location }, { merge: true });
    await setDoc(doc(db, 'publicProfiles', currentUser.uid), { location, updatedAt: Date.now() }, { merge: true }).catch(() => undefined);
    await refreshProfile().catch(() => undefined);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile) {
      setError('Please log in again before publishing.');
      return;
    }
    setError('');
    setUploadProgress({ active: false, done: false, phase: '', fileName: '', currentFile: 0, totalFiles: 0, bytesTransferred: 0, totalBytes: 0, percent: 0 });
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
        price: type === 'sell' ? parseFloat(price) || 0 : 0,
        images: [],
        userId: currentUser.uid,
        userName: userProfile.displayName || currentUser.displayName || 'Reshelved User',
        userPhoto: userProfile.photoURL || '',
        location,
        createdAt: now,
        expiresAt: now + TEN_DAYS,
        active: true,
        flagged: false,
        flagCount: 0
      });
      await syncDefaultLocationIfNeeded();
      if (images.length > 0) await uploadListingImages(docRef.id, [...images]);
      setUploadProgress({ active: true, done: true, phase: 'Uploaded Successfully!', fileName: '', currentFile: images.length || 1, totalFiles: images.length || 1, bytesTransferred: 0, totalBytes: 0, percent: 100 });
      window.setTimeout(() => navigate(`/listing/${docRef.id}`), 900);
    } catch (err: any) {
      console.error('Failed to publish listing:', err);
      setError(err?.message || 'Failed to create listing. Check your Firebase rules.');
      setUploadProgress((current) => ({ ...current, active: false, done: false }));
      setLoading(false);
    }
  };

  const previewTitle = title.trim() || 'Book title will appear here';
  const previewAuthor = author.trim() || 'Author name';
  const activeListingType = listingTypes.find((item) => item.value === type);

  return (
    <div className="bg-[#F7F7F5] px-4 py-8 sm:px-6 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-stone-950 sm:text-5xl">List a Book</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-stone-500">Create a clean, trustworthy listing in a few guided steps.</p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#F7AF31]/60 bg-[#FFF4E2] px-4 py-2 text-sm font-bold text-stone-700">
            <i className="las la-bolt text-lg text-primary-600" /> Draft saved automatically
          </div>
        </div>

        <div className="mb-6 grid gap-3 rounded-[28px] border border-stone-200 bg-white p-3 shadow-sm sm:grid-cols-4">
          {[['1', 'Photos'], ['2', 'Details'], ['3', 'Terms'], ['4', 'Publish']].map(([step, label], index) => (
            <div key={step} className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${index < 2 ? 'bg-stone-50' : ''}`}>
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${index < 2 ? 'bg-primary-600 text-white' : 'bg-stone-100 text-stone-500'}`}>{step}</span>
              <span className={`text-sm font-bold ${index < 2 ? 'text-stone-950' : 'text-stone-400'}`}>{label}</span>
            </div>
          ))}
        </div>

        {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
        {uploadProgress.active && (
          <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4">
            <div className="flex items-center justify-between gap-3 text-sm"><p className="font-semibold text-green-700 truncate">{uploadProgress.phase}{uploadProgress.fileName ? `: ${uploadProgress.fileName}` : ''}</p><span className="font-bold text-green-700">{uploadProgress.percent}%</span></div>
            {!uploadProgress.done && <p className="text-green-600 mt-1 text-sm">File {uploadProgress.currentFile} of {uploadProgress.totalFiles} · {formatBytes(uploadProgress.bytesTransferred)} / {formatBytes(uploadProgress.totalBytes)}</p>}
            <div className="mt-3 h-2 rounded-full bg-white overflow-hidden"><div className="h-full rounded-full bg-green-600 transition-all duration-200" style={{ width: `${uploadProgress.percent}%` }} /></div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)] lg:items-start">
          <div className="rounded-[32px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7 lg:p-8">
            <section>
              <div className="mb-5">
                <h2 className="text-2xl font-bold text-stone-950">Photos</h2>
                <p className="mt-1 text-sm leading-6 text-stone-500">Add up to 4 photos. The first photo becomes the cover.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-[minmax(230px,0.85fr)_1fr]">
                <label className={`flex min-h-[220px] flex-col items-center justify-center rounded-[28px] border-2 border-dashed border-stone-300 bg-stone-50 text-center transition hover:border-[#1665CC] hover:bg-[#1665CC]/5 ${loading || previews.length >= MAX_IMAGES ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                  <i className="las la-plus text-5xl text-primary-600" />
                  <span className="mt-3 text-base font-bold text-stone-950">Drag photos here</span>
                  <span className="mt-1 text-sm text-stone-500">or click to upload</span>
                  <input type="file" accept="image/*" multiple onChange={handleImageChange} disabled={loading || previews.length >= MAX_IMAGES} className="hidden" />
                </label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-2 xl:grid-cols-4">
                  {previews.map((preview, i) => (
                    <div key={i} className="group relative aspect-square overflow-hidden rounded-3xl border border-stone-200 bg-stone-100">
                      <img src={preview} alt="" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => removeImage(i)} disabled={loading} className="absolute right-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-red-500 text-sm font-bold text-white opacity-0 transition group-hover:opacity-100 disabled:opacity-40">×</button>
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, MAX_IMAGES - previews.length) }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square rounded-3xl border border-stone-200 bg-stone-50" />
                  ))}
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-stone-500">The full photo opens first. Cropping only happens after you adjust it and click Use Photo.</p>
            </section>

            <section className="mt-8 border-t border-stone-100 pt-8">
              <h2 className="text-2xl font-bold text-stone-950">Book Details</h2>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><label className={labelClass}>Book Title *</label><input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} disabled={loading} className={inputClass} placeholder="e.g. Things Fall Apart" /></div>
                <div><label className={labelClass}>Author *</label><input type="text" required value={author} onChange={(e) => setAuthor(e.target.value)} disabled={loading} className={inputClass} placeholder="e.g. Chinua Achebe" /></div>
                <div className="sm:col-span-2"><label className={labelClass}>Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={loading} rows={4} className={`${inputClass} resize-none`} placeholder="Tell us about the book condition, edition, and notes." /></div>
                <div><label className={labelClass}>Condition *</label><select value={condition} onChange={(e) => setCondition(e.target.value as Listing['condition'])} disabled={loading} className={`${inputClass} pr-10`}>{CONDITIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                <div><label className={labelClass}>Category *</label><select value={category} onChange={(e) => setCategory(e.target.value)} disabled={loading} className={`${inputClass} pr-10`}>{CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                <div><label className={labelClass}>Location *</label><select value={location} onChange={(e) => setLocation(e.target.value)} disabled={loading} className={`${inputClass} pr-10`}>{KENYAN_CITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                {type === 'sell' && <div><label className={labelClass}>Price (KSh) *</label><input type="number" required min="0" value={price} onChange={(e) => setPrice(e.target.value)} disabled={loading} className={inputClass} placeholder="e.g. 500" /></div>}
                {!userProfile?.location && <p className="sm:col-span-2 text-xs leading-5 text-stone-500"><i className="las la-info-circle mr-1.5 align-[-2px] text-base text-stone-400" /><span>You can change your default location in <Link to="/profile#settings" className="font-semibold text-[#1665CC] underline underline-offset-2 hover:text-[#1254a9]">profile settings</Link>.</span></p>}
              </div>
            </section>

            <section className="mt-8 border-t border-stone-100 pt-8">
              <h2 className="text-2xl font-bold text-stone-950">Listing Type</h2>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {listingTypes.map((item) => (
                  <button key={item.value} type="button" disabled={loading} onClick={() => setType(item.value)} className={`cursor-pointer rounded-[24px] border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${type === item.value ? 'border-primary-600 bg-[#FFF4E2]' : 'border-stone-200 bg-white hover:border-[#1665CC] hover:bg-[#1665CC]/5'}`}>
                    <i className={`${item.icon} text-3xl ${type === item.value ? 'text-primary-600' : 'text-stone-500'}`} />
                    <div className="mt-3 text-sm font-bold text-stone-950">{item.label}</div>
                    <div className="mt-1 text-xs leading-5 text-stone-500">{item.desc}</div>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <aside className="lg:sticky lg:top-24">
            <div className="rounded-[32px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
              <div>
                <h2 className="text-2xl font-bold text-stone-950">Live Preview</h2>
                <p className="mt-1 text-sm leading-6 text-stone-500">See what buyers will see before you publish.</p>
              </div>
              <div className="mt-6 overflow-hidden rounded-[28px] border border-stone-200 bg-[#FFF4E2]">
                <div className="flex aspect-[4/3] items-center justify-center bg-[#FFF4E2] p-5">
                  {previews[0] ? <img src={previews[0]} alt="Book cover preview" className="h-full w-full rounded-2xl object-cover" /> : <div className="flex h-full w-full flex-col items-center justify-center rounded-2xl bg-primary-600 p-6 text-center text-white"><span className="text-xl font-bold leading-tight">{previewTitle}</span><span className="mt-4 text-xs opacity-80">{previewAuthor}</span></div>}
                </div>
              </div>
              <h3 className="mt-6 text-xl font-bold leading-tight text-stone-950">{previewTitle}</h3>
              <p className="mt-1 text-sm text-stone-500">by {previewAuthor}</p>
              <div className="mt-5 grid grid-cols-3 gap-2 text-xs font-bold text-stone-700">
                <span className="rounded-2xl bg-stone-50 px-3 py-2"><i className="las la-check-circle mr-1 text-primary-600" />{condition}</span>
                <span className="rounded-2xl bg-stone-50 px-3 py-2"><i className="las la-map-marker mr-1 text-primary-600" />{location}</span>
                <span className="rounded-2xl bg-stone-50 px-3 py-2"><i className="las la-book mr-1 text-primary-600" />{category}</span>
              </div>
              <div className="mt-6">
                <p className="text-sm font-bold text-stone-950">Listing Type</p>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary-600 bg-[#FFF4E2] px-4 py-2 text-sm font-bold text-stone-950"><i className={`${activeListingType?.icon || 'las la-tag'} text-primary-600`} />{activeListingType?.label || 'Listing'}</div>
                {type === 'sell' && <div className="mt-3 text-sm font-bold text-stone-950">KSh {price || '0'}</div>}
              </div>
              <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-800"><i className="las la-info-circle mr-1 text-lg text-green-700" />Images are converted to WebP before upload so they look clean and load faster.</div>
              <button type="submit" disabled={loading} className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Publishing...' : 'Publish Listing'}</button>
              <button type="button" onClick={() => navigate(-1)} disabled={loading} className="mx-auto mt-3 block cursor-pointer border-0 bg-transparent px-4 py-1 text-sm font-bold text-stone-500 transition hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
            </div>
          </aside>
        </form>
      </div>

      {cropFile && cropSrc && <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"><div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl"><div className="flex items-start justify-between gap-4 mb-4"><div><h2 className="text-lg font-bold text-stone-900">Crop Photo</h2><p className="text-sm text-stone-500">The full image is shown first. Zoom in only if you want to crop.</p></div><button type="button" onClick={skipCurrentCrop} className="cursor-pointer text-stone-400 hover:text-stone-700 text-xl">×</button></div><div className="aspect-square rounded-xl overflow-hidden bg-stone-100 border border-stone-200 relative"><img src={cropSrc} alt="Crop preview" className="w-full h-full object-contain select-none" style={{ transform: `translate(${cropX * 0.6}px, ${cropY * 0.6}px) scale(${cropZoom})`, transformOrigin: 'center' }} /><div className="absolute inset-0 border-4 border-white/70 pointer-events-none rounded-xl" /></div><div className="space-y-4 mt-5"><div><label className="text-sm font-medium text-stone-700">Zoom</label><input type="range" min="1" max="3" step="0.05" value={cropZoom} onChange={(e) => setCropZoom(parseFloat(e.target.value))} className="w-full accent-primary-600 cursor-pointer" /></div><div><label className="text-sm font-medium text-stone-700">Move left / right</label><input type="range" min="-100" max="100" value={cropX} onChange={(e) => setCropX(parseInt(e.target.value))} className="w-full accent-primary-600 cursor-pointer" /></div><div><label className="text-sm font-medium text-stone-700">Move up / down</label><input type="range" min="-100" max="100" value={cropY} onChange={(e) => setCropY(parseInt(e.target.value))} className="w-full accent-primary-600 cursor-pointer" /></div></div><div className="grid grid-cols-2 gap-3 mt-5"><button type="button" onClick={skipCurrentCrop} className="cursor-pointer py-2.5 border border-stone-200 rounded-xl text-sm font-semibold text-stone-600 hover:bg-stone-50">Skip</button><button type="button" onClick={addCroppedImage} className="cursor-pointer py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700">Use Photo</button></div></div></div>}
    </div>
  );
};

export default CreateListing;
