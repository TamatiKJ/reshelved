import React, { useEffect, useState } from 'react';

const brandBlue = '#1665CC';
const autoAdvanceMs = 6000;

const steps = [
  {
    title: 'List your book once',
    description: 'Add title, author, condition, photos, and location so readers know what you have before they message you.',
    imageLabel: 'Image placeholder 560 x 424',
  },
  {
    title: 'Choose sell, swap, or donate',
    description: 'Pick how you want the book to move. Sell it for cash, swap it, or give it to a reader who needs it.',
    imageLabel: 'Image placeholder 560 x 424',
  },
  {
    title: 'Message and agree',
    description: 'Talk inside Reshelved, confirm the book, and agree on the handover when both sides are ready.',
    imageLabel: 'Image placeholder 560 x 424',
  },
  {
    title: 'Rate your exchange',
    description: 'Leave a quick rating after the exchange so other readers know who they can trust.',
    imageLabel: 'Image placeholder 560 x 424',
  },
];

type Step = (typeof steps)[number];

const ImagePlaceholder = ({ label }: { label: string }) => (
  <div className="flex h-[424px] w-full items-center justify-center border border-stone-200 bg-[#FFF9F0] p-6">
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center bg-white text-[#1665CC] shadow-sm">
        <i className="las la-image text-2xl" />
      </div>
      <p className="mt-4 font-[Work_Sans] text-lg font-black text-stone-950">{label}</p>
      <p className="mt-2 text-sm leading-6 text-stone-500">Replace this with the matching step image.</p>
    </div>
  </div>
);

const DesktopStep = ({ step, index, active, onClick }: { step: Step; index: number; active: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={`relative w-full border border-stone-200 bg-white px-5 py-4 text-left transition ${active ? 'opacity-100' : 'opacity-55 hover:opacity-85'}`}
  >
    <span className="absolute bottom-0 left-0 top-0 w-1 bg-stone-200" />
    {active && (
      <span
        key={step.title}
        className="absolute left-0 top-0 w-1 bg-[#1665CC]"
        style={{ animation: `how-it-works-progress ${autoAdvanceMs}ms linear forwards` }}
      />
    )}
    <div className="pl-4">
      <div className="flex items-center gap-3">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${active ? 'bg-[#1665CC] text-white' : 'bg-stone-100 text-stone-500'}`}>
          {index + 1}
        </span>
        <h3 className={`font-[Work_Sans] text-[17px] leading-6 text-stone-950 ${active ? 'font-black' : 'font-bold'}`}>{step.title}</h3>
      </div>
      <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">{step.description}</p>
    </div>
  </button>
);

const MobileAccordionItem = ({ step, index, open, onToggle }: { step: Step; index: number; open: boolean; onToggle: () => void }) => (
  <div className="border border-stone-200 bg-white">
    <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
      <div className="flex items-center gap-3">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${open ? 'bg-[#1665CC] text-white' : 'bg-stone-100 text-stone-500'}`}>
          {index + 1}
        </span>
        <h3 className="font-[Work_Sans] text-[17px] font-black leading-6 text-stone-950">{step.title}</h3>
      </div>
      <i className={`las ${open ? 'la-angle-up' : 'la-angle-down'} text-lg text-stone-600`} />
    </button>
    {open && (
      <div className="border-t border-stone-200 px-5 pb-5 pt-4">
        <ImagePlaceholder label={step.imageLabel} />
        <p className="mt-4 text-sm leading-6 text-stone-600">{step.description}</p>
      </div>
    )}
  </div>
);

const HowItWorksScroller = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [openStep, setOpenStep] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setActiveStep((current) => (current + 1) % steps.length);
    }, autoAdvanceMs);

    return () => window.clearTimeout(timer);
  }, [activeStep]);

  return (
    <section className="bg-white py-14 sm:py-20">
      <style>{`
        @keyframes how-it-works-progress {
          from { height: 0%; }
          to { height: 100%; }
        }
      `}</style>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: brandBlue }}>Simple Steps</p>
          <h2 className="mt-3 font-[Work_Sans] text-4xl font-black tracking-[-0.03em] text-stone-950 sm:text-5xl">How it works</h2>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-stone-600">No confusion or delays. Just fast and reliable book trading.</p>
        </div>

        <div className="mt-12 hidden gap-8 lg:grid lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="sticky top-28">
            <ImagePlaceholder label={steps[activeStep].imageLabel} />
          </div>
          <div className="space-y-2">
            {steps.map((step, index) => (
              <DesktopStep key={step.title} step={step} index={index} active={activeStep === index} onClick={() => setActiveStep(index)} />
            ))}
          </div>
        </div>

        <div className="mt-8 space-y-2 lg:hidden">
          {steps.map((step, index) => (
            <MobileAccordionItem
              key={step.title}
              step={step}
              index={index}
              open={openStep === index}
              onToggle={() => setOpenStep((current) => (current === index ? -1 : index))}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksScroller;
