import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CATEGORIES, CONDITIONS, KENYAN_CITIES } from '../types';
import type { Listing } from '../types';

const MAX_IMAGES = 4;
const MAX_LISTING_IMAGE_SIZE = 1400;
const UPLOAD_STALL_TIMEOUT = 30000;

const listingTypes = [
  { value: 'swap', label: 'Swap', icon: 'las la-sync' },
  { value: 'donate', label: 'Donate', icon: 'las la-gift' },
  { value: 'sell', label: 'Sell', icon: 'las la-tag' }
] as const;

const normalizeImages = (images?: unknown): string[] => {
  if (!Array.isArray(images)) return [];
  return images.filter((image): image is string => typeof image === 'string' && image.trim().length > 0);
};

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not read this image. Try a JPG, PNG, or WebP file.'));
    image.src = src;
  });
};

const cropListingImage = async (file: File, cropSrc: string, zoom: number, offsetX: number, offsetY: number): Promise<File> => {
  const image = await loadImage(cropSrc);
  const canvas = document.createElement('canvas');
  canvas.width = MAX_LISTING_IMAGE_SIZE;
  canvas.height = MAX_LISTING_IMAGE_SIZE;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image processing is not supported in this browser.');

  const cropSize = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
  const maxX = Math.max(0, (image.naturalWidth - cropSize) / 2);
  const maxY = Math.max(0, (image.naturalHeight - cropSize) / 2);
  const sx = Math.min(Math.max(0, image.naturalWidth / 2 - cropSize / 2 + (offsetX / 100) * maxX), image.naturalWidth - cropSize);
  const sy = Math.min(Math.max(0, image.naturalHeight / 2 - cropSize / 2 + (offsetY / 100) * maxY), image.naturalHeight - cropSize);

  ctx.drawImage(image, sx, sy, cropSize, cropSize, 0, 0, MAX_LISTING_IMAGE_SIZE, MAX_LISTING_IMAGE_SIZE);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error('Could not convert image to WebP.'));
        return;
      }
      resolve(result);
    }, 'image/webp', 0.84);
  });

  const safeFileName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '-');
  return new File([blob], `${safeFileName}-cropped.webp`, { type: 'image/webp' });
};

interface EditableImage {
  id: string;
  url: string;
  file?: File;
  isNew?: boolean;
}

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
  const [editableImages, setEditableImages] = useState<EditableImage[]>([]);
  const [cropQueue, setCropQueue] = useState<File[]>([]);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropSrc, setCropSrc] = useState('');
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [uploadProgress, setUploadProgress] = useState({ active: false, currentFile: 0, totalFiles: 0, percent: 0, fileName: '' });

  const canEditListing = (item: Listing) => Boolean(currentUser && (item.userId === currentUser.uid || userProfile?.isAdmin));
  const canAddMoreImages = editableImages.length < MAX_IMAGES;
  const newImages = useMemo(() => editableImages.filter((image) => image.file), [editableImages]);

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
        setEditableImages(normalizeImages(data.images).map((url) => ({ id: url, url })));
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

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = '';
    const availableSlots = MAX_IMAGES - editableImages.length;

    if (selectedFiles.length > availableSlots) {
      setError(`You can only add ${availableSlots} more image${availableSlots === 1 ? '' : 's'}.`);
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
      setEditableImages((current) => [...current, { id: `${Date.now()}-${croppedFile.name}`, url: previewUrl, file: croppedFile, isNew: true }]);

      const [nextFile, ...remainingFiles] = cropQueue;
      if (nextFile && editableImages.length + 1 < MAX_IMAGES) {
        openCropEditor(nextFile, remainingFiles);
      } else {
        setCropFile(null);
        setCropSrc('');
        setCropQueue([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not crop this image.');
    }
  };

  const skipCurrentCrop = () => {
    const [nextFile, ...remainingFiles] = cropQueue;
    if (nextFile) {
      openCropEditor(nextFile, remainingFiles);
      return;
    }
    setCropFile(null);
    setCropSrc('');
    setCropQueue([]);
  };

  const removeImage = (imageId: string) => {
    setEditableImages((current) => {
      const target = current.find((image) => image.id === imageId);
      if (target?.url.startsWith('blob:')) URL.revokeObjectURL(target.url);
      return current.filter((image) => image.id !== imageId);
    });
  };

  const uploadImageFile = async (file: File, listingId: string, index: number, totalFiles: number) => {
    if (!currentUser) throw new Error('You must be logged in to upload images.');

    const safeFileName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '-');
    const storageRef = ref(storage, `listings/${currentUser.uid}/${listingId}_${Date.now()}_${safeFileName}.webp`);
    const task = uploadBytesResumable(storageRef, file, { contentType: 'image/webp' });

    setUploadProgress({ active: true, currentFile: index + 1, totalFiles, percent: 0, fileName: file.name });

    return new Promise<string>((resolve, reject) => {
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
        setUploadProgress({ active: true, currentFile: index + 1, totalFiles, percent, fileName: file.name });
      }, (uploadError) => {
        window.clearTimeout(stallTimer);
        reject(uploadError);
      }, async () => {
        window.clearTimeout(stallTimer);
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      });
    });
  };

  const uploadEditedImages = async (listingId: string) => {
    const uploadedNewImages = new Map<string, string>();
    const filesToUpload = editableImages.filter((image) => image.file);

    for (let i = 0; i < filesToUpload.length; i += 1) {
      const image = filesToUpload[i];
      const url = await uploadImageFile(image.file!, listingId, i, filesToUpload.length);
      uploadedNewImages.set(image.id, url);
    }

    return editableImages.map((image) => uploadedNewImages.get(image.id) || image.url).filter((url) => !url.startsWith('blob:'));
  };

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
      const imageUrls = await uploadEditedImages(listing.id);
      const updates = {
        title: title.trim(),
        author: author.trim(),
        description: description.trim(),
        condition,
        category,
        type,
        price: type === 'sell' ? parseFloat(price) || 0 : 0,
        location,
        images: imageUrls,
        updatedAt: Date.now()
      };

      if (!updates.title || !updates.author) {
        setError('Book title and author are required.');
        setSaving(false);
        setUploadProgress({ active: false, currentFile: 0, totalFiles: 0, percent: 0, fileName: '' });
        return;
      }

      await updateDoc(doc(db, 'listings', listing.id), updates);
      navigate(`/listing/${listing.id}`);
    } catch (err: any) {
      console.error('Error saving listing:', err);
      setError(err?.message || 'Could not save listing. Check your Firestore rules.');
      setSaving(false);
      setUploadProgress({ active: false, currentFile: 0, totalFiles: 0, percent: 0, fileName: '' });
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
          <p className="text-sm text-stone-500 mt-1">Update the book details and photos buyers see.</p>
        </div>
        {listing && <Link to={`/listing/${listing.id}`} className="text-sm font-semibold text-primary-600 hover:text-primary-700">Cancel</Link>}
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 sm:p-8 space-y-5">
        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>}

        {uploadProgress.active && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="font-semibold text-green-700 truncate">Uploading image {uploadProgress.currentFile} of {uploadProgress.totalFiles}: {uploadProgress.fileName}</p>
              <span className="font-bold text-green-700">{uploadProgress.percent}%</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white overflow-hidden">
              <div className="h-full rounded-full bg-green-600 transition-all duration-200" style={{ width: `${uploadProgress.percent}%` }} />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">Photos (up to 4)</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {editableImages.map((image) => (
              <div key={image.id} className="relative aspect-square rounded-xl overflow-hidden border border-stone-200 group">
                <img src={image.url} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removeImage(image.id)} disabled={saving} className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-xs disabled:opacity-40">×</button>
                {image.isNew && <span className="absolute left-1.5 bottom-1.5 px-2 py-0.5 rounded-full bg-primary-600 text-white text-[10px] font-semibold">New</span>}
              </div>
            ))}
            {canAddMoreImages && (
              <label className={`aspect-square rounded-xl border-2 border-dashed border-stone-300 hover:border-primary-400 flex flex-col items-center justify-center transition hover:bg-primary-50 ${saving ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                <i className="las la-plus text-3xl text-stone-400" />
                <span className="text-xs text-stone-500 mt-1">Add Photo</span>
                <input type="file" accept="image/*" multiple onChange={handleImageChange} disabled={saving} className="hidden" />
              </label>
            )}
          </div>
          <p className="text-xs text-stone-500 mt-2">Remove old photos or add new cropped photos. The saved order is left to right.</p>
        </div>

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
            {listingTypes.map((item) => (
              <button key={item.value} type="button" onClick={() => setType(item.value as Listing['type'])} className={`cursor-pointer p-3 rounded-xl border-2 text-center transition ${type === item.value ? 'border-primary-500 bg-primary-50' : 'border-stone-200 hover:border-stone-300'}`}>
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

      {cropFile && cropSrc && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-stone-900">Crop Photo</h2>
                <p className="text-sm text-stone-500">Choose what part should be visible.</p>
              </div>
              <button type="button" onClick={skipCurrentCrop} className="cursor-pointer text-stone-400 hover:text-stone-700 text-xl">×</button>
            </div>

            <div className="aspect-square rounded-xl overflow-hidden bg-stone-100 border border-stone-200 relative">
              <img src={cropSrc} alt="Crop preview" className="w-full h-full object-cover select-none" style={{ transform: `translate(${cropX * 0.6}px, ${cropY * 0.6}px) scale(${cropZoom})`, transformOrigin: 'center' }} />
              <div className="absolute inset-0 border-4 border-white/70 pointer-events-none rounded-xl" />
            </div>

            <div className="space-y-4 mt-5">
              <div><label className="text-sm font-medium text-stone-700">Zoom</label><input type="range" min="1" max="3" step="0.05" value={cropZoom} onChange={(event) => setCropZoom(parseFloat(event.target.value))} className="w-full accent-primary-600 cursor-pointer" /></div>
              <div><label className="text-sm font-medium text-stone-700">Move left / right</label><input type="range" min="-100" max="100" value={cropX} onChange={(event) => setCropX(parseInt(event.target.value))} className="w-full accent-primary-600 cursor-pointer" /></div>
              <div><label className="text-sm font-medium text-stone-700">Move up / down</label><input type="range" min="-100" max="100" value={cropY} onChange={(event) => setCropY(parseInt(event.target.value))} className="w-full accent-primary-600 cursor-pointer" /></div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button type="button" onClick={skipCurrentCrop} className="cursor-pointer py-2.5 border border-stone-200 rounded-xl text-sm font-semibold text-stone-600 hover:bg-stone-50">Skip</button>
              <button type="button" onClick={addCroppedImage} className="cursor-pointer py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700">Use Photo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditListing;
