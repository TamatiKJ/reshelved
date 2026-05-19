import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addDoc, collection, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CATEGORIES, CONDITIONS, KENYAN_CITIES } from '../types';
import type { Listing } from '../types';
import DiscardListingModal from '../components/create-listing/DiscardListingModal';
import { useCreateListingCancel } from '../hooks/useCreateListingCancel';

const DEFAULT_LISTING_DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_IMAGES = 4;
const MAX_LISTING_IMAGE_SIZE = 1400;
const UPLOAD_STALL_TIMEOUT = 30000;
const focusFieldClass = 'focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10';
const fieldClass = `w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 disabled:bg-stone-50 ${focusFieldClass}`;
const labelClass = 'mb-1.5 block text-sm font-bold text-stone-950';

type CreateStep = 1 | 2 | 3;
type DragState = { startX: number; startY: number; cropX: number; cropY: number } | null;

const listingTypes = [
  { value: 'swap', label: 'Swap', icon: 'las la-sync', desc: 'Trade for another book' },
  { value: 'donate', label: 'Donate', icon: 'las la-gift', desc: 'Give away for free' },
  { value: 'sell', label: 'Sell', icon: 'las la-tag', desc: 'Set your price' }
] as const;

const steps: Array<{ id: CreateStep; label: string }> = [
  { id: 1, label: 'Photos' },
  { id: 2, label: 'Details' },
  { id: 3, label: 'Preview' }
];

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

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
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Could not convert image.')), 'image/webp', 0.84);
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
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not convert image.')), 'image/webp', 0.82);
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const CreateListing: React.FC = () => {
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<CreateStep>(1);
  const [listingDays, setListingDays] = useState(DEFAULT_LISTING_DAYS);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState<Listing['condition']>('Good');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [type, setType] = useState<Listing['type']>('swap');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState(userProfile?.location || 'Lavington');
  const [conditionTouched, setConditionTouched] = useState(false);
  const [locationTouched, setLocationTouched] = useState(false);
  const [categoryTouched, setCategoryTouched] = useState(false);
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
  const [dragState, setDragState] = useState<DragState>(null);
  const [uploadProgress, setUploadProgress] = useState({ active: false, done: false, phase: '', fileName: '', currentFile: 0, totalFiles: 0, bytesTransferred: 0, totalBytes: 0, percent: 0 });

  const defaultLocation = userProfile?.location || 'Lavington';
  const activeListingType = useMemo(() => listingTypes.find((item) => item.value === type), [type]);
  const previewTitle = title.trim() || 'Book title will appear here';
  const previewAuthor = author.trim() || 'Author Name';
  const previewPrice = type === 'sell' ? `KSh ${price || '0'}` : type === 'donate' ? 'Free' : 'Swap';
  const previewCondition = conditionTouched ? condition : 'Condition';
  const previewLocation = locationTouched ? location : 'Location';
  const previewCategory = categoryTouched ? category : 'Category';

  const validateStepOne = () => {
    if (images.length < 1) return 'Upload at least one book photo before continuing.';
    return '';
  };

  const validateStepTwo = () => {
    if (!title.trim()) return 'Add the book title before continuing.';
    if (!author.trim()) return 'Add the author before continuing.';
    if (!description.trim()) return 'Add a short description before continuing.';
    if (!conditionTouched) return 'Choose the book condition before continuing.';
    if (!categoryTouched) return 'Choose the book category before continuing.';
    if (!locationTouched) return 'Choose the book location before continuing.';
    if (type === 'sell' && (!price.trim() || Number(price) <= 0)) return 'Add a valid price before continuing.';
    return '';
  };

  const getAccessError = (targetStep: CreateStep) => {
    if (targetStep >= 2) {
      const stepOneError = validateStepOne();
      if (stepOneError) return stepOneError;
    }
    if (targetStep >= 3) {
      const stepTwoError = validateStepTwo();
      if (stepTwoError) return stepTwoError;
    }
    return '';
  };

  const canAccessStep = (targetStep: CreateStep) => !getAccessError(targetStep);

  const { showCancelConfirm, requestCancel, keepEditing, discardDraft } = useCreateListingCancel({
    title,
    author,
    description,
    price,
    previews,
    imagesCount: images.length,
    condition,
    category,
    type,
    location,
    defaultLocation,
    loading
  });

  useEffect(() => {
    const loadListingDays = async () => {
      const snapshot = await getDoc(doc(db, 'platform', 'settings')).catch(() => null);
      const days = Number(snapshot?.exists() ? snapshot.data().listingDays : DEFAULT_LISTING_DAYS) || DEFAULT_LISTING_DAYS;
      setListingDays(Math.max(1, Math.min(45, days)));
    };
    loadListingDays();
  }, []);

  useEffect(() => {
    if (!userProfile?.location) return;
    setLocation((current) => current || userProfile.location || 'Lavington');
  }, [userProfile?.location]);

  const openCropEditor = (file: File, queue: File[]) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setCropFile(file);
      setCropQueue(queue);
      setCropSrc(reader.result as string);
      setCropZoom(1);
      setCropX(0);
      setCropY(0);
      setDragState(null);
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
    setDragState(null);
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
    setError('');
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
      setError('');
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

  const handleCropPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({ startX: event.clientX, startY: event.clientY, cropX, cropY });
  };

  const handleCropPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState) return;
    const nextX = dragState.cropX + (event.clientX - dragState.startX) / 2.4;
    const nextY = dragState.cropY + (event.clientY - dragState.startY) / 2.4;
    setCropX(clamp(nextX, -100, 100));
    setCropY(clamp(nextY, -100, 100));
  };

  const stopCropDrag = () => setDragState(null);

  const uploadSingleFile = async (listingId: string, file: File, index: number, totalFiles: number): Promise<string> => {
    if (!currentUser) throw new Error('You must be logged in to upload images.');
    setUploadProgress({ active: true, done: false, phase: 'Preparing image', fileName: file.name, currentFile: index + 1, totalFiles, bytesTransferred: 0, totalBytes: file.size, percent: 0 });
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

  const goToStep = (nextStep: CreateStep) => {
    if (nextStep <= step) {
      setError('');
      setStep(nextStep);
      return;
    }

    const accessError = getAccessError(nextStep);
    if (accessError) {
      setError(accessError);
      return;
    }

    setError('');
    setStep(nextStep);
  };

  const handleNextStep = () => {
    const nextStep = step === 1 ? 2 : 3;
    const accessError = getAccessError(nextStep as CreateStep);
    if (accessError) {
      setError(accessError);
      return;
    }
    setError('');
    setStep(nextStep as CreateStep);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalValidationError = getAccessError(3);
    if (finalValidationError) {
      setError(finalValidationError);
      if (validateStepOne()) setStep(1);
      else setStep(2);
      return;
    }
    if (step !== 3) {
      handleNextStep();
      return;
    }
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
        title: title.trim(),
        author: author.trim(),
        description: description.trim(),
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
        expiresAt: now + listingDays * DAY_MS,
        listingDays,
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

  const cancelButton = (
    <button type="button" onClick={requestCancel} disabled={loading} className="ml-auto cursor-pointer px-2 py-3 text-sm font-bold text-red-600 transition hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50">Cancel and Exit</button>
  );

  const livePreview = (
    <aside className="lg:sticky lg:top-24">
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-xl font-bold text-stone-950 sm:text-2xl">Live Preview</h2>
        <p className="mt-1 text-sm text-stone-500">See how it looks before you publish.</p>
        <div className="mt-4 aspect-[4/3] overflow-hidden rounded-2xl bg-stone-100">
          {previews[0] ? <img src={previews[0]} alt="Book cover preview" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-stone-100 text-center text-sm font-semibold text-stone-400">Cover image will appear here</div>}
        </div>
        <h3 className="mt-4 text-xl font-bold leading-tight text-stone-950">{previewTitle}</h3>
        <p className="mt-1 text-sm text-stone-500">by {previewAuthor}</p>
        <div className="mt-5 grid grid-cols-3 gap-2 text-xs font-bold text-stone-600">
          <span className="min-w-0 truncate"><i className="las la-check-circle mr-1 text-primary-600" />{previewCondition}</span>
          <span className="min-w-0 truncate"><i className="las la-map-marker mr-1 text-primary-600" />{previewLocation}</span>
          <span className="min-w-0 truncate"><i className="las la-book mr-1 text-primary-600" />{previewCategory}</span>
        </div>
        <div className="mt-5">
          <p className="text-sm font-bold text-stone-950">Listing Type</p>
          <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-stone-200 px-4 py-2 text-sm font-bold text-stone-950"><i className={`${activeListingType?.icon || 'las la-tag'} text-primary-600`} />{activeListingType?.label || 'Listing'}</span>
          <p className="mt-3 text-sm font-bold text-stone-950">{previewPrice}</p>
        </div>
        <div className="mt-5 rounded-2xl bg-green-50 p-4 text-sm leading-6 text-green-800"><i className="las la-info-circle mr-1 text-lg text-green-700" />Your listing will be active for {listingDays} {listingDays === 1 ? 'day' : 'days'} after publishing.</div>
      </div>
    </aside>
  );

  return (
    <div className="bg-[#F7F7F5] px-4 py-8 sm:px-6 lg:py-10">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-stone-950 sm:text-5xl">List a Book</h1>
            <p className="mt-2 text-base leading-7 text-stone-500">Create a clean trustworthy listing in a few guided steps.</p>
          </div>
          <p className="text-sm font-bold text-stone-500">Draft Saved Automatically</p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="min-w-0 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="grid grid-cols-3 gap-2 bg-white p-3 sm:gap-3 sm:p-4">
              {steps.map((item) => {
                const active = step === item.id;
                const locked = item.id > step && !canAccessStep(item.id);
                return <button key={item.id} type="button" onClick={() => goToStep(item.id)} disabled={loading || locked} className={`flex min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl px-2 py-3 text-center transition disabled:cursor-not-allowed disabled:opacity-50 sm:flex-row sm:justify-start sm:gap-3 sm:px-4 sm:text-left ${active ? 'bg-stone-50' : 'hover:bg-stone-50'}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${active ? 'bg-primary-600 text-white' : 'border border-stone-300 bg-stone-100 text-stone-600'}`}>{item.id}</span><span className={`max-w-full truncate text-xs font-bold sm:text-sm ${active ? 'text-stone-950' : 'text-stone-500'}`}>{item.label}</span></button>;
              })}
            </div>

            {error && <div className="mx-4 mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            {uploadProgress.active && <div className="mx-4 mb-4 rounded-xl border border-green-200 bg-green-50 p-4"><div className="flex items-center justify-between gap-3 text-sm"><p className="font-semibold text-green-700 truncate">{uploadProgress.phase}{uploadProgress.fileName ? `: ${uploadProgress.fileName}` : ''}</p><span className="font-bold text-green-700">{uploadProgress.percent}%</span></div>{!uploadProgress.done && <p className="text-green-600 mt-1 text-sm">File {uploadProgress.currentFile} of {uploadProgress.totalFiles} · {formatBytes(uploadProgress.bytesTransferred)} / {formatBytes(uploadProgress.totalBytes)}</p>}<div className="mt-3 h-2 rounded-full bg-white overflow-hidden"><div className="h-full rounded-full bg-green-600 transition-all duration-200" style={{ width: `${uploadProgress.percent}%` }} /></div></div>}

            <div className="p-4 sm:p-6 lg:p-8">
              {step === 1 && <div><h2 className="text-2xl font-bold text-stone-950">Photos</h2><p className="mt-1 text-sm leading-6 text-stone-500">Add up to 4 photos. The first photo becomes the cover.</p><div className="mt-6 grid gap-3 sm:grid-cols-[240px_1fr]"><label className={`flex min-h-[210px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-[#FAFAF9] text-center transition hover:border-primary-600 hover:bg-primary-50/40 ${loading || previews.length >= MAX_IMAGES ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}><i className="las la-plus text-6xl text-primary-600" /><span className="mt-2 text-base font-bold text-stone-950">Drag photos here</span><span className="mt-1 text-sm text-stone-500">or click to upload</span><input type="file" accept="image/*" multiple onChange={handleImageChange} disabled={loading || previews.length >= MAX_IMAGES} className="hidden" /></label><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{previews.map((preview, i) => <div key={i} className="group relative aspect-square overflow-hidden rounded-2xl border border-stone-200 bg-stone-100"><img src={preview} alt="" className="h-full w-full object-cover" /><button type="button" onClick={() => removeImage(i)} disabled={loading} className="absolute right-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-red-500 text-sm font-bold text-white opacity-0 transition group-hover:opacity-100 disabled:opacity-40">×</button></div>)}{Array.from({ length: Math.max(0, MAX_IMAGES - previews.length) }).map((_, i) => <div key={`empty-${i}`} className="aspect-square rounded-2xl border border-stone-200 bg-white" />)}</div></div><p className="mt-3 text-xs leading-5 text-stone-500">Upload JPG, PNG, or WebP images up to 5MB each.</p><h2 className="mt-8 text-2xl font-bold text-stone-950">Listing Type</h2><div className="mt-5 grid gap-3 sm:grid-cols-3">{listingTypes.map((item) => <button key={item.value} type="button" disabled={loading} onClick={() => setType(item.value)} className={`cursor-pointer rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${type === item.value ? 'border-primary-600 bg-primary-50/60 ring-1 ring-primary-600/10' : 'border-stone-200 bg-white hover:border-primary-600'}`}><i className={`${item.icon} text-3xl text-stone-950`} /><div className="mt-3 text-sm font-bold text-stone-950">{item.label}</div><div className="mt-1 text-xs leading-5 text-stone-500">{item.desc}</div></button>)}</div><div className="mt-6 flex flex-wrap items-center gap-3"><button type="button" onClick={handleNextStep} disabled={loading} className="cursor-pointer rounded-lg bg-primary-600 px-8 py-3 text-sm font-bold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">Next Step</button>{cancelButton}</div></div>}

              {step === 2 && <div><h2 className="text-2xl font-bold text-stone-950">Book Details</h2><div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2"><div><label className={labelClass}>Book Title *</label><input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} disabled={loading} className={fieldClass} placeholder="e.g. Things Fall Apart" /></div><div><label className={labelClass}>Author *</label><input type="text" required value={author} onChange={(e) => setAuthor(e.target.value)} disabled={loading} className={fieldClass} placeholder="e.g. Chinua Achebe" /></div><div className="sm:col-span-2"><label className={labelClass}>Description *</label><textarea required value={description} onChange={(e) => setDescription(e.target.value)} disabled={loading} rows={4} className={`${fieldClass} resize-none`} placeholder="Tell us about the book condition, edition, and notes." /></div><div><label className={labelClass}>Condition *</label><select value={condition} onChange={(e) => { setCondition(e.target.value as Listing['condition']); setConditionTouched(true); }} disabled={loading} className={`${fieldClass} pr-10`}>{CONDITIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div><label className={labelClass}>Category *</label><select value={category} onChange={(e) => { setCategory(e.target.value); setCategoryTouched(true); }} disabled={loading} className={`${fieldClass} pr-10`}>{CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div><label className={labelClass}>Location *</label><select value={location} onChange={(e) => { setLocation(e.target.value); setLocationTouched(true); }} disabled={loading} className={`${fieldClass} pr-10`}>{KENYAN_CITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>{type === 'sell' && <div><label className={labelClass}>Price (KSh) *</label><input type="number" required min="1" value={price} onChange={(e) => setPrice(e.target.value)} disabled={loading} className={fieldClass} placeholder="e.g. 500" /></div>}{!userProfile?.location && <p className="sm:col-span-2 text-xs leading-5 text-stone-500"><i className="las la-info-circle mr-1.5 align-[-2px] text-base text-stone-400" /><span>You can change your default location in <Link to="/profile#settings" className="font-semibold text-[#1665CC] underline underline-offset-2 hover:text-[#1254a9]">profile settings</Link>.</span></p>}</div><div className="mt-6 flex flex-wrap items-center gap-3"><button type="button" onClick={() => goToStep(1)} disabled={loading} className="cursor-pointer rounded-lg border border-stone-200 px-8 py-3 text-sm font-bold text-stone-600 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50">Back</button><button type="button" onClick={handleNextStep} disabled={loading} className="cursor-pointer rounded-lg bg-primary-600 px-8 py-3 text-sm font-bold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">Next Step</button>{cancelButton}</div></div>}

              {step === 3 && <div><h2 className="text-2xl font-bold text-stone-950">Preview</h2><p className="mt-1 text-sm leading-6 text-stone-500">Review your listing before publishing.</p><div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5 text-sm leading-6 text-green-800"><p className="font-bold text-green-900">Your listing will be active after publishing.</p><p className="mt-1">It will be visible on your account page, visible publicly in browse results, and active for {listingDays} {listingDays === 1 ? 'day' : 'days'}.</p></div><div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-5"><div className="grid gap-4 text-sm sm:grid-cols-2"><div><span className="font-bold text-stone-500">Title</span><p className="mt-1 font-bold text-stone-950">{previewTitle}</p></div><div><span className="font-bold text-stone-500">Author</span><p className="mt-1 text-stone-700">{previewAuthor}</p></div><div><span className="font-bold text-stone-500">Listing</span><p className="mt-1 text-stone-700">{activeListingType?.label}</p></div><div><span className="font-bold text-stone-500">Value</span><p className="mt-1 text-stone-700">{previewPrice}</p></div></div></div><div className="mt-6 flex flex-wrap items-center gap-3"><button type="button" onClick={() => goToStep(2)} disabled={loading} className="cursor-pointer rounded-lg border border-stone-200 px-8 py-3 text-sm font-bold text-stone-600 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50">Back</button><button type="submit" disabled={loading} className="cursor-pointer rounded-lg bg-primary-600 px-8 py-3 text-sm font-bold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Publishing...' : 'Publish Listing'}</button>{cancelButton}</div></div>}
            </div>
          </div>
          {livePreview}
        </form>
      </div>

      <DiscardListingModal open={showCancelConfirm} onKeepEditing={keepEditing} onDiscard={discardDraft} />

      {cropFile && cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-3 backdrop-blur-sm sm:p-6">
          <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl ring-1 ring-black/10">
            <div className="flex items-center justify-between gap-4 border-b border-stone-200 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-lg font-bold text-stone-950 sm:text-xl">Edit photo</h2>
                <p className="text-sm text-stone-500">Drag to reposition, then use the slider to zoom.</p>
              </div>
              <button type="button" onClick={skipCurrentCrop} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900" aria-label="Close crop editor"><i className="las la-times text-2xl" /></button>
            </div>

            <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="flex min-h-[430px] items-center justify-center bg-[#111827] p-4 sm:p-8">
                <div onPointerDown={handleCropPointerDown} onPointerMove={handleCropPointerMove} onPointerUp={stopCropDrag} onPointerCancel={stopCropDrag} className={`relative aspect-square w-full max-w-[560px] touch-none overflow-hidden rounded-[24px] bg-stone-900 ${dragState ? 'cursor-grabbing' : 'cursor-grab'}`}>
                  <img src={cropSrc} alt="Crop preview" draggable={false} className="h-full w-full select-none object-contain opacity-95 transition-transform duration-75" style={{ transform: `translate(${cropX * 0.6}px, ${cropY * 0.6}px) scale(${cropZoom})`, transformOrigin: 'center' }} />
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_63%,rgba(0,0,0,0.48)_64%)]" />
                  <div className="pointer-events-none absolute inset-6 rounded-[22px] border-2 border-white shadow-[0_0_0_999px_rgba(0,0,0,0.22)]" />
                  <div className="pointer-events-none absolute inset-6 grid grid-cols-3 grid-rows-3 rounded-[22px] overflow-hidden opacity-45">
                    {Array.from({ length: 9 }).map((_, index) => <span key={index} className="border border-white/45" />)}
                  </div>
                </div>
              </div>

              <div className="flex flex-col border-t border-stone-200 bg-white p-5 lg:border-l lg:border-t-0 sm:p-6">
                <div className="rounded-2xl bg-stone-50 p-4">
                  <p className="text-sm font-bold text-stone-950">Photo preview</p>
                  <div className="mt-3 aspect-square overflow-hidden rounded-2xl bg-stone-200">
                    <img src={cropSrc} alt="Small crop preview" className="h-full w-full object-contain" style={{ transform: `translate(${cropX * 0.36}px, ${cropY * 0.36}px) scale(${cropZoom})`, transformOrigin: 'center' }} />
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm"><span className="font-bold text-stone-800">Zoom</span><span className="text-stone-500">{Math.round(cropZoom * 100)}%</span></div>
                    <input type="range" min="1" max="3" step="0.05" value={cropZoom} onChange={(e) => setCropZoom(parseFloat(e.target.value))} className="w-full accent-primary-600 cursor-pointer" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => { setCropZoom(1); setCropX(0); setCropY(0); }} className="cursor-pointer rounded-xl border border-stone-200 px-4 py-3 text-sm font-bold text-stone-700 transition hover:bg-stone-50">Reset</button>
                    <button type="button" onClick={skipCurrentCrop} className="cursor-pointer rounded-xl border border-stone-200 px-4 py-3 text-sm font-bold text-stone-700 transition hover:bg-stone-50">Skip</button>
                  </div>
                </div>

                <div className="mt-auto pt-5">
                  <button type="button" onClick={addCroppedImage} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-primary-700"><i className="las la-check text-xl" />Use Photo</button>
                  <p className="mt-3 text-center text-xs leading-5 text-stone-500">This will be used as the image shown on your listing.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateListing;
