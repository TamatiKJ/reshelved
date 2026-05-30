import React, { useEffect, useState } from 'react';

const autoAdvanceMs = 6000;

const steps = [
  {
    title: 'List your book',
    description: 'One listing puts your book in front of nearby readers. No reposting, no repeating yourself.',
    imageLabel: 'Image placeholder 1 460 x 420',
    icon: 'la-book-open',
  },
  {
    title: 'Choose your exchange and location',
    description: 'Want cash, a new read, or a clear shelf? Pick how it moves and where you want to meet.',
    imageLabel: 'Image placeholder 2 460 x 420',
    icon: 'la-exchange-alt',
  },
  {
    title: 'Message, meet, and rate',
    description: 'Chat with your reader, agree on a spot, and meet up. A quick rating afterwards keeps the community honest.',
    imageLabel: 'Image placeholder 3 460 x 420',
    icon: 'la-comment-dots',
  },
];

type Step = (typeof steps)[number];

const ImagePlaceholder = ({ label }: { label: string }) => (
  <div className="flex h-[420px] w-full max-w-[460px] items-center justify-center rounded-none border border-stone-200 bg-[#FFF9F0] p-6">
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-white text-primary-600 shadow-sm">
        <i className="las la-image text-2xl" />
      </div>
      <p className="mt-4 font-[Work_Sans] text-lg font-black text-stone-950">{label}</p>
      <p className="mt-2 text-sm leading-6 text-stone-500">Replace this with the matching step image.</p>
    </div>
  </div>
);

const StepIcon = ({ icon, active }: { icon: string; active: boolean }) => (
  <span
    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg transition ${
      active ? 'bg-[#FFF4E2] text-primary-600 shadow-sm' : 'border border-stone-200 bg-white text-stone-500'
    }`}
  >
    <i className={`las ${icon} text-3xl`} />
  </span>
);

const DesktopStep = ({ step, active, onClick }: { step: Step; active: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={`relative w-full rounded-none border-0 py-4 pl-8 pr-5 text-left transition ${active ? 'bg-stone-50 opacity-100' : 'bg-white opacity-55 hover:bg-stone-50 hover:opacity-85'}`}
  >
    <span className="absolute bottom-0 left-0 top-0 w-1 bg-stone-200" />
    {active && (
      <span
        key={step.title}
        className="absolute left-0 top-0 w-1 bg-primary-600"
        style={{ animation: `how-it-works-progress ${autoAdvanceMs}ms linear forwards` }}
      />
    )}
    <div className="grid gap-5 sm:grid-cols-[56px_1fr] sm:items-start">
      <StepIcon icon={step.icon} active={active} />
      <div>
        <h3 className="font-[Work_Sans] text-[20px] font-black leading-7 text-stone-950">{step.title}</h3>
        <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">{step.description}</p>
      </div>
    </div>
  </button>
);

const MobileAccordionItem = ({ step, open, onToggle }: { step: Step; open: boolean; onToggle: () => void }) => (
  <div className={`rounded-2xl border border-stone-200 bg-white ${open ? 'bg-stone-50' : ''}`}>
    <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
      <div className="flex items-center gap-4">
        <StepIcon icon={step.icon} active={open} />
        <h3 className="font-[Work_Sans] text-[18px] font-black leading-6 text-stone-950">{step.title}</h3>
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
        <div className="max-w-3xl">
          <h2 className="font-[Work_Sans] text-4xl font-black tracking-[-0.03em] text-stone-950 sm:text-5xl">Read More, Spend Less</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">Reshelved helps you find cheaper second-hand books in Nairobi, so you can reach your reading goals without stretching your budget.</p>
        </div>

        <div className="mt-12 hidden gap-10 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="space-y-3">
            {steps.map((step, index) => (
              <DesktopStep key={step.title} step={step} active={activeStep === index} onClick={() => setActiveStep(index)} />
            ))}
          </div>
          <div className="sticky top-28 flex justify-end">
            <ImagePlaceholder label={steps[activeStep].imageLabel} />
          </div>
        </div>

        <div className="mt-8 space-y-3 lg:hidden">
          {steps.map((step, index) => (
            <MobileAccordionItem
              key={step.title}
              step={step}
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
