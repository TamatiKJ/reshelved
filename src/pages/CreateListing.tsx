import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-stone-800">List a Book</h1>
      <p className="text-stone-500 mt-1">Share your book with the Reshelved community</p>
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 sm:p-8 mt-6">
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>}
        {uploadProgress.active && (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4">
            <div className="flex items-center justify-between gap-3 text-sm"><p className="font-semibold text-green-700 truncate">{uploadProgress.phase}{uploadProgress.fileName ? `: ${uploadProgress.fileName}` : ''}</p><span className="font-bold text-green-700">{uploadProgress.percent}%</span></div>
            {!uploadProgress.done && <p className="text-green-600 mt-1 text-sm">File {uploadProgress.currentFile} of {uploadProgress.totalFiles} · {formatBytes(uploadProgress.bytesTransferred)} / {formatBytes(uploadProgress.totalBytes)}</p>}
            <div className="mt-3 h-2 rounded-full bg-white overflow-hidden"><div className="h-full rounded-full bg-green-600 transition-all duration-200" style={{ width: `${uploadProgress.percent}%` }} /></div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Photos (up to 4)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {previews.map((preview, i) => <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-stone-200 group"><img src={preview} alt="" className="w-full h-full object-cover" /><button type="button" onClick={() => removeImage(i)} disabled={loading} className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-xs disabled:opacity-40">×</button></div>)}
              {previews.length < MAX_IMAGES && <label className={`aspect-square rounded-xl border-2 border-dashed border-stone-300 hover:border-[#1665CC] flex flex-col items-center justify-center transition hover:bg-[#1665CC]/5 ${loading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}><i className="las la-plus text-3xl text-stone-400" /><span className="text-xs text-stone-500 mt-1">Add Photo</span><input type="file" accept="image/*" multiple onChange={handleImageChange} disabled={loading} className="hidden" /></label>}
            </div>
            <p className="text-xs text-stone-500 mt-2">The full photo opens first. Cropping only happens after you adjust it and click Use Photo.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-stone-700 mb-1">Book Title *</label><input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} disabled={loading} className={`w-full px-4 py-3 rounded-xl border border-stone-200 ${focusFieldClass} outline-none transition text-sm disabled:bg-stone-50`} placeholder="e.g. Things Fall Apart" /></div><div><label className="block text-sm font-medium text-stone-700 mb-1">Author *</label><input type="text" required value={author} onChange={(e) => setAuthor(e.target.value)} disabled={loading} className={`w-full px-4 py-3 rounded-xl border border-stone-200 ${focusFieldClass} outline-none transition text-sm disabled:bg-stone-50`} placeholder="e.g. Chinua Achebe" /></div></div>
          <div><label className="block text-sm font-medium text-stone-700 mb-1">Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={loading} rows={3} className={`w-full px-4 py-3 rounded-xl border border-stone-200 ${focusFieldClass} outline-none transition text-sm resize-none disabled:bg-stone-50`} placeholder="Tell us about the book condition, edition, and notes." /></div>
          <div><label className="block text-sm font-medium text-stone-700 mb-2">Listing Type *</label><div className="grid grid-cols-3 gap-3">{listingTypes.map((item) => <button key={item.value} type="button" disabled={loading} onClick={() => setType(item.value)} className={`cursor-pointer p-3 rounded-xl border-2 text-center transition disabled:cursor-not-allowed disabled:opacity-60 ${type === item.value ? 'border-[#1665CC] bg-[#1665CC]/10' : 'border-stone-200 hover:border-[#1665CC] hover:bg-[#1665CC]/5'}`}><i className={`${item.icon} text-3xl text-primary-600`} /><div className="text-sm font-semibold text-stone-800 mt-1">{item.label}</div><div className="text-xs text-stone-500 mt-0.5">{item.desc}</div></button>)}</div></div>
          {type === 'sell' && <div><label className="block text-sm font-medium text-stone-700 mb-1">Price (KSh) *</label><input type="number" required min="0" value={price} onChange={(e) => setPrice(e.target.value)} disabled={loading} className={`w-full px-4 py-3 rounded-xl border border-stone-200 ${focusFieldClass} outline-none transition text-sm disabled:bg-stone-50`} placeholder="e.g. 500" /></div>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><div><label className="block text-sm font-medium text-stone-700 mb-1">Condition *</label><select value={condition} onChange={(e) => setCondition(e.target.value as Listing['condition'])} disabled={loading} className={`w-full pl-4 pr-10 py-3 rounded-xl border border-stone-200 ${focusFieldClass} outline-none transition text-sm bg-white disabled:bg-stone-50`}>{CONDITIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div><label className="block text-sm font-medium text-stone-700 mb-1">Category *</label><select value={category} onChange={(e) => setCategory(e.target.value)} disabled={loading} className={`w-full pl-4 pr-10 py-3 rounded-xl border border-stone-200 ${focusFieldClass} outline-none transition text-sm bg-white disabled:bg-stone-50`}>{CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div><label className="block text-sm font-medium text-stone-700 mb-1">Location *</label><select value={location} onChange={(e) => setLocation(e.target.value)} disabled={loading} className={`w-full pl-4 pr-10 py-3 rounded-xl border border-stone-200 ${focusFieldClass} outline-none transition text-sm bg-white disabled:bg-stone-50`}>{KENYAN_CITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div></div>
          {!userProfile?.location && <div className="bg-[#FFF4E2] border border-primary-200 rounded-xl p-4 flex items-start gap-3"><i className="las la-map-marker-alt text-2xl text-primary-700" /><div className="text-sm text-stone-800"><p className="font-semibold">This location will become your default.</p><p className="text-stone-600 mt-0.5">You can still change it later from your profile settings.</p></div></div>}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3"><i className="las la-info-circle text-2xl text-green-700" /><div className="text-sm text-green-800"><p className="font-medium">Your listing will publish after images finish uploading</p><p className="text-green-700 mt-0.5">Images are converted to WebP before upload so they look clean and load faster.</p></div></div>
          <button type="submit" disabled={loading} className="w-full cursor-pointer py-3.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2">{loading ? 'Publishing...' : 'Publish Listing'}</button>
          <button type="button" onClick={() => navigate(-1)} disabled={loading} className="mx-auto block cursor-pointer border-0 bg-transparent px-4 py-1 text-sm font-semibold text-stone-500 transition hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
        </form>
      </div>

      {cropFile && cropSrc && <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"><div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl"><div className="flex items-start justify-between gap-4 mb-4"><div><h2 className="text-lg font-bold text-stone-900">Crop Photo</h2><p className="text-sm text-stone-500">The full image is shown first. Zoom in only if you want to crop.</p></div><button type="button" onClick={skipCurrentCrop} className="cursor-pointer text-stone-400 hover:text-stone-700 text-xl">×</button></div><div className="aspect-square rounded-xl overflow-hidden bg-stone-100 border border-stone-200 relative"><img src={cropSrc} alt="Crop preview" className="w-full h-full object-contain select-none" style={{ transform: `translate(${cropX * 0.6}px, ${cropY * 0.6}px) scale(${cropZoom})`, transformOrigin: 'center' }} /><div className="absolute inset-0 border-4 border-white/70 pointer-events-none rounded-xl" /></div><div className="space-y-4 mt-5"><div><label className="text-sm font-medium text-stone-700">Zoom</label><input type="range" min="1" max="3" step="0.05" value={cropZoom} onChange={(e) => setCropZoom(parseFloat(e.target.value))} className="w-full accent-primary-600 cursor-pointer" /></div><div><label className="text-sm font-medium text-stone-700">Move left / right</label><input type="range" min="-100" max="100" value={cropX} onChange={(e) => setCropX(parseInt(e.target.value))} className="w-full accent-primary-600 cursor-pointer" /></div><div><label className="text-sm font-medium text-stone-700">Move up / down</label><input type="range" min="-100" max="100" value={cropY} onChange={(e) => setCropY(parseInt(e.target.value))} className="w-full accent-primary-600 cursor-pointer" /></div></div><div className="grid grid-cols-2 gap-3 mt-5"><button type="button" onClick={skipCurrentCrop} className="cursor-pointer py-2.5 border border-stone-200 rounded-xl text-sm font-semibold text-stone-600 hover:bg-stone-50">Skip</button><button type="button" onClick={addCroppedImage} className="cursor-pointer py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700">Use Photo</button></div></div></div>}
    </div>
  );
};

export default CreateListing;
