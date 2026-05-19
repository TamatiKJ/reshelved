import React from 'react';

export type ListingFormStep = 1 | 2 | 3;

export type ListingStepItem = {
  id: ListingFormStep;
  label: string;
};

const ListingStepper: React.FC<{
  steps: ListingStepItem[];
  activeStep: ListingFormStep;
  disabled?: boolean;
  canAccessStep?: (step: ListingFormStep) => boolean;
  onStepChange: (step: ListingFormStep) => void;
}> = ({ steps, activeStep, disabled = false, canAccessStep, onStepChange }) => {
  return (
    <div className="grid grid-cols-3 gap-2 bg-white p-3 sm:gap-3 sm:p-4">
      {steps.map((item) => {
        const active = activeStep === item.id;
        const locked = Boolean(canAccessStep && !canAccessStep(item.id));

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onStepChange(item.id)}
            disabled={disabled || locked}
            className={`flex min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl px-2 py-3 text-center transition disabled:cursor-not-allowed disabled:opacity-50 sm:flex-row sm:justify-start sm:gap-3 sm:px-4 sm:text-left ${active ? 'bg-stone-50' : 'hover:bg-stone-50'}`}
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${active ? 'bg-primary-600 text-white' : 'border border-stone-300 bg-stone-100 text-stone-600'}`}>{item.id}</span>
            <span className={`max-w-full truncate text-xs font-bold sm:text-sm ${active ? 'text-stone-950' : 'text-stone-500'}`}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ListingStepper;
