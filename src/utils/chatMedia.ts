import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase';

const MAX_CHAT_IMAGE_WIDTH = 900;
const MAX_CHAT_IMAGE_BYTES = 700 * 1024;

export const compressChatImage = async (file: File): Promise<{ blob: Blob; size: number }> => {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image.')); };
    img.src = url;
  });

  const scale = Math.min(1, MAX_CHAT_IMAGE_WIDTH / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image compression is not supported in this browser.');

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((output) => output ? resolve(output) : reject(new Error('Could not compress image.')), 'image/webp', 0.65);
  });

  if (blob.size > MAX_CHAT_IMAGE_BYTES) throw new Error('Image is still too large after compression. Try a smaller photo.');
  return { blob, size: blob.size };
};

export const uploadChatImage = async (conversationId: string, messageId: string, file: File) => {
  const compressed = await compressChatImage(file);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/\.[^.]+$/, '') || 'chat-image';
  const storagePath = `messages/${conversationId}/${messageId}/${safeName}.webp`;
  const uploadResult = await uploadBytes(ref(storage, storagePath), compressed.blob, { contentType: 'image/webp' });
  const imageUrl = await getDownloadURL(uploadResult.ref);
  return {
    imageUrl,
    imageName: file.name,
    imageSize: compressed.size,
    storagePath
  };
};
