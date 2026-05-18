const MAX_WEBP_UPLOAD_BYTES = 200 * 1024;
const WEBP_UPLOAD_QUALITY = 0.82;
const MIN_WEBP_SIDE = 420;

let isCompressionPatchInstalled = false;

const resizeCanvas = (sourceCanvas: HTMLCanvasElement, maxSide: number) => {
  const ratio = Math.min(1, maxSide / Math.max(sourceCanvas.width, sourceCanvas.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceCanvas.width * ratio));
  canvas.height = Math.max(1, Math.round(sourceCanvas.height * ratio));
  const context = canvas.getContext('2d');
  if (!context) return sourceCanvas;
  context.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
  return canvas;
};

export const enforceWebpUploadCompression = () => {
  if (typeof window === 'undefined' || isCompressionPatchInstalled) return;
  isCompressionPatchInstalled = true;

  const originalToBlob = HTMLCanvasElement.prototype.toBlob;

  HTMLCanvasElement.prototype.toBlob = function patchedToBlob(callback, type, quality) {
    if (type !== 'image/webp') {
      return originalToBlob.call(this, callback, type, quality);
    }

    let maxSide = Math.max(this.width, this.height);
    let canvas: HTMLCanvasElement = this;

    const tryCompress = () => {
      originalToBlob.call(canvas, (blob) => {
        if (!blob) {
          callback(blob);
          return;
        }

        if (blob.size <= MAX_WEBP_UPLOAD_BYTES || maxSide <= MIN_WEBP_SIDE) {
          callback(blob);
          return;
        }

        maxSide = Math.max(MIN_WEBP_SIDE, Math.floor(maxSide * 0.86));
        canvas = resizeCanvas(this, maxSide);
        tryCompress();
      }, 'image/webp', WEBP_UPLOAD_QUALITY);
    };

    tryCompress();
    return undefined;
  };
};
