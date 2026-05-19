import React from 'react';

interface DiscardListingModalProps {
  open: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
}

const DiscardListingModal: React.FC<DiscardListingModalProps> = ({ open, onKeepEditing, onDiscard }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl ring-1 ring-black/10">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF4E2] text-[#D54215]">
          <i className="las la-exclamation-circle text-3xl" />
        </div>
        <h2 className="mt-5 text-2xl font-bold tracking-tight text-stone-950">Discard listing?</h2>
        <p className="mt-2 text-sm leading-6 text-stone-500">Your photos and details will be lost. This action cannot be undone.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onKeepEditing} className="cursor-pointer rounded-xl border border-stone-200 px-5 py-3 text-sm font-bold text-stone-700 transition hover:bg-stone-50">Keep Editing</button>
          <button type="button" onClick={onDiscard} className="cursor-pointer rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-primary-700">Discard Listing</button>
        </div>
      </div>
    </div>
  );
};

export default DiscardListingModal;
