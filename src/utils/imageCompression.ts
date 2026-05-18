const MAX_LISTING_IMAGE_SIZE = 1400;
const MIN_LISTING_IMAGE_SIZE = 420;
const MAX_LISTING_UPLOAD_BYTES = 200 * 1024;
const LISTING_WEBP_QUALITY = 0.82;

const loadImage = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Could not read this image. Try a JPG, PNG, or WebP file.'));
  image.src = src;
});

const canvasToWebpBlob = (canvas: HTMLCanvasElement): Promise<Blob> => new Promise((resolve, reject) => {
  canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('Could not convert image to WebP.')),
    'image/webp',
    LISTING_WEBP_QUALITY
  );
});

const resizeCanvasToMaxSide = (sourceCanvas: HTMLCanvasElement, maxSide: number) => {
  const ratio = Math.min(1, maxSide / Math.max(sourceCanvas.width, sourceCanvas.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceCanvas.width * ratio));
  canvas.height = Math.max(1, Math.round(sourceCanvas.height * ratio));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image processing is not supported in this browser.');
  ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const canvasToTargetWebpBlob = async (sourceCanvas: HTMLCanvasElement): Promise<Blob> => {
  let maxSide = Math.max(sourceCanvas.width, sourceCanvas.height);
  let workingCanvas = sourceCanvas;

  while (true) {
    const blob = await canvasToWebpBlob(workingCanvas);
    if (blob.size <= MAX_LISTING_UPLOAD_BYTES || maxSide <= MIN_LISTING_IMAGE_SIZE) return blob;
    maxSide = Math.max(MIN_LISTING_IMAGE_SIZE, Math.floor(maxSide * 0.86));
    workingCanvas = resizeCanvasToMaxSide(sourceCanvas, maxSide);
  }
};

export const compressImageFileToWebpBlob = async (file: File): Promise<Blob> => {
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
    return await canvasToTargetWebpBlob(canvas);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export const LISTING_IMAGE_UPLOAD_LIMIT_LABEL = '200KB';
export const LISTING_IMAGE_WEBP_QUALITY_LABEL = '0.82';
