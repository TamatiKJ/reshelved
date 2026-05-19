import React from 'react';

export type CropValues = {
  src: string;
  zoom: number;
  x: number;
  y: number;
};

type DragState = { startX: number; startY: number; cropX: number; cropY: number } | null;

type Props = {
  crop: CropValues;
  dragState: DragState;
  onDragStart: (event: React.PointerEvent<HTMLDivElement>) => void;
  onDragMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onZoomChange: (zoom: number) => void;
  onReset: () => void;
  onSkip: () => void;
  onUsePhoto: () => void;
};

const ListingImageCropModal: React.FC<Props> = ({ crop, dragState, onDragStart, onDragMove, onDragEnd, onZoomChange, onReset, onSkip, onUsePhoto }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl ring-1 ring-black/10">
        <div className="flex items-center justify-between gap-4 border-b border-stone-200 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-bold text-stone-950 sm:text-xl">Edit photo</h2>
            <p className="text-sm text-stone-500">Drag to reposition, then use the slider to zoom.</p>
          </div>
          <button type="button" onClick={onSkip} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900" aria-label="Close crop editor"><i className="las la-times text-2xl" /></button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-h-[430px] items-center justify-center bg-[#111827] p-4 sm:p-8">
            <div onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd} className={`relative aspect-square w-full max-w-[560px] touch-none overflow-hidden rounded-[24px] bg-stone-900 ${dragState ? 'cursor-grabbing' : 'cursor-grab'}`}>
              <img src={crop.src} alt="Crop preview" draggable={false} className="h-full w-full select-none object-contain opacity-95 transition-transform duration-75" style={{ transform: `translate(${crop.x * 0.6}px, ${crop.y * 0.6}px) scale(${crop.zoom})`, transformOrigin: 'center' }} />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_63%,rgba(0,0,0,0.48)_64%)]" />
              <div className="pointer-events-none absolute inset-6 rounded-[22px] border-2 border-white shadow-[0_0_0_999px_rgba(0,0,0,0.22)]" />
              <div className="pointer-events-none absolute inset-6 grid grid-cols-3 grid-rows-3 overflow-hidden rounded-[22px] opacity-45">
                {Array.from({ length: 9 }).map((_, index) => <span key={index} className="border border-white/45" />)}
              </div>
            </div>
          </div>

          <div className="flex flex-col border-t border-stone-200 bg-white p-5 sm:p-6 lg:border-l lg:border-t-0">
            <div className="rounded-2xl bg-stone-50 p-4">
              <p className="text-sm font-bold text-stone-950">Photo preview</p>
              <div className="mt-3 aspect-square overflow-hidden rounded-2xl bg-stone-200">
                <img src={crop.src} alt="Small crop preview" className="h-full w-full object-contain" style={{ transform: `translate(${crop.x * 0.36}px, ${crop.y * 0.36}px) scale(${crop.zoom})`, transformOrigin: 'center' }} />
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm"><span className="font-bold text-stone-800">Zoom</span><span className="text-stone-500">{Math.round(crop.zoom * 100)}%</span></div>
                <input type="range" min="1" max="3" step="0.05" value={crop.zoom} onChange={(event) => onZoomChange(parseFloat(event.target.value))} className="w-full cursor-pointer accent-primary-600" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={onReset} className="cursor-pointer rounded-xl border border-stone-200 px-4 py-3 text-sm font-bold text-stone-700 transition hover:bg-stone-50">Reset</button>
                <button type="button" onClick={onSkip} className="cursor-pointer rounded-xl border border-stone-200 px-4 py-3 text-sm font-bold text-stone-700 transition hover:bg-stone-50">Skip</button>
              </div>
            </div>

            <div className="mt-auto pt-5">
              <button type="button" onClick={onUsePhoto} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-primary-700"><i className="las la-check text-xl" />Use Photo</button>
              <p className="mt-3 text-center text-xs leading-5 text-stone-500">This will be used as the image shown on your listing.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingImageCropModal;
