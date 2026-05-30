import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const processSteps = [
  {
    number: '1',
    icon: 'la-user-plus',
    title: 'Create your free account',
    description: 'Sign up so you can save books, list your own books, message other readers, and manage your exchanges from one place.',
  },
  {
    number: '2',
    icon: 'la-search',
    title: 'Find books near you',
    description: 'Search by title, author, category, condition, price, exchange type, and Nairobi location instead of scrolling through scattered posts.',
  },
  {
    number: '3',
    icon: 'la-clipboard-check',
    title: 'Check the listing details',
    description: 'Review the book photos, condition, seller details, location, price, and whether the owner wants to sell, swap, or donate.',
  },
  {
    number: '4',
    icon: 'la-comments',
    title: 'Message and arrange the exchange',
    description: 'Use the in-app chat to ask questions, agree on terms, and arrange a safe handover directly with the book owner.',
  },
];

const benefits = [
  {
    icon: 'la-map-marker-alt',
    title: 'Search books by Nairobi location',
    description: 'Find books closer to where you live, study, or work.',
  },
  {
    icon: 'la-tags',
    title: 'See condition before contacting',
    description: 'Each listing gives key details before you start messaging.',
  },
  {
    icon: 'la-sync-alt',
    title: 'Sell, swap, or donate',
    description: 'Choose the exchange type that fits the book and the reader.',
  },
  {
    icon: 'la-star',
    title: 'Use ratings and reviews',
    description: 'Feedback helps readers identify reliable book owners.',
  },
];

const storySteps = [
  {
    id: 'list',
    eyebrow: 'Step 1',
    icon: 'la-book-open',
    title: 'List your book once',
    description: 'Add title, author, condition, photos, and location so readers know what you have before they message you.',
  },
  {
    id: 'choose',
    eyebrow: 'Step 2',
    icon: 'la-sync-alt',
    title: 'Choose sell, swap, or donate',
    description: 'Pick how you want the book to move. Sell it for cash, swap it, or give it to a reader who needs it.',
  },
  {
    id: 'message',
    eyebrow: 'Step 3',
    icon: 'la-comments',
    title: 'Message and agree',
    description: 'Talk inside Reshelved, confirm the book, and agree on the handover when both sides are ready.',
  },
  {
    id: 'rate',
    eyebrow: 'Step 4',
    icon: 'la-star',
    title: 'Rate your exchange',
    description: 'Leave a quick rating after the exchange so other readers know who they can trust.',
  },
];

const platformFeatures = [
  {
    title: 'Verified accounts',
    description: 'Every user signs in before they list, save, or message.',
  },
  {
    title: 'Book photos',
    description: 'See real book photos before you talk to the owner.',
  },
  {
    title: 'Smart filters',
    description: 'Find books by title, author, type, price, and location.',
  },
  {
    title: 'In-app messages',
    description: 'Talk about the book without moving to many apps first.',
  },
  {
    title: 'Ratings and reviews',
    description: 'Check what other readers say before you agree to meet.',
  },
  {
    title: 'Report controls',
    description: 'Report bad listings so the platform can stay clean.',
  },
];

const faqs = [
  {
    question: 'How does Reshelved work?',
    answer: 'Reshelved is a peer-to-peer book exchange platform for readers in Nairobi. You create an account, search for books, review listing details, message the owner, and arrange the sale, swap, or donation directly.',
  },
  {
    question: 'Is Reshelved free to use?',
    answer: 'Yes. You can browse books, create an account, list books, and message other users for free. If a book is being sold, payment is agreed directly between the buyer and seller.',
  },
  {
    question: 'Can I sell second-hand books on Reshelved?',
    answer: 'Yes. You can list second-hand books for sale by adding the title, author, photos, condition, price, category, and location. Readers can then find your listing and contact you through the platform.',
  },
  {
    question: 'Can I swap books with other readers in Nairobi?',
    answer: 'Yes. Reshelved supports book swaps. When listing a book, choose the swap option so other readers know you are open to exchanging it for another book.',
  },
  {
    question: 'Can I donate books on Reshelved?',
    answer: 'Yes. You can mark a listing as a donation if you want to give the book away for free. This helps unused books reach readers who need them.',
  },
  {
    question: 'Does Reshelved deliver books?',
    answer: 'No. Reshelved does not handle delivery at this stage. Users communicate through the platform and agree on their own pickup, meet-up, or delivery arrangement.',
  },
  {
    question: 'How can I find second-hand books near me in Nairobi?',
    answer: 'Use the search and filters on Reshelved to look for books by location, title, author, category, condition, price, and exchange type. This makes it easier to find second-hand books near your preferred Nairobi area.',
  },
  {
    question: 'How do I know if a book seller is trustworthy?',
    answer: 'Reshelved supports trust through user accounts, clear listings, book photos, condition labels, in-app messaging, ratings, reviews, and reporting tools. You should still confirm the book and meet in a safe public place before completing an exchange.',
  },
  {
    question: 'What types of books can I find on Reshelved?',
    answer: 'You can find academic books, novels, business books, self-development books, children’s books, and other physical books listed by readers, students, parents, and book owners in Nairobi.',
  },
];

const MiniBookCard = ({ title, meta }: { title: string; meta: string }) => (
  <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
    <div className="flex aspect-[4/5] items-center justify-center rounded-xl bg-[#FFF4E2]">
      <i className="las la-book text-4xl text-primary-600" />
    </div>
    <p className="mt-3 truncate text-sm font-bold text-stone-950">{title}</p>
    <p className="mt-1 text-xs font-semibold text-stone-500">{meta}</p>
  </div>
);

const HeroVisual = () => (
  <div className="relative">
    <div className="absolute -left-5 top-8 hidden rounded-full bg-primary-600 px-4 py-2 text-sm font-bold text-white shadow-xl lg:block">
      Books near you
    </div>
    <div className="rounded-[32px] border border-white/10 bg-white p-4 shadow-2xl shadow-black/50">
      <div className="flex min-h-[430px] items-center justify-center rounded-[24px] bg-[#ffdd00] p-8">
        <div className="text-center text-stone-950">
          <i className="las la-image text-7xl" />
          <p className="mt-4 font-[Work_Sans] text-2xl font-black">Image placeholder</p>
          <p className="mt-2 max-w-sm text-sm font-semibold text-stone-800">Add your Figma SaaS illustration or product screenshot here.</p>
        </div>
      </div>
    </div>
  </div>
);

const PhoneMockup = ({ activeStep }: { activeStep: number }) => {
  const current = storySteps[activeStep];

  return (
    <div className="relative mx-auto w-full max-w-[360px]">
      <div className="absolute -left-10 top-16 hidden h-28 w-28 rounded-full bg-[#0F766E]/10 blur-2xl lg:block" />
      <div className="absolute -right-8 bottom-16 hidden h-36 w-36 rounded-full bg-primary-600/10 blur-2xl lg:block" />
      <div className="relative rounded-[46px] border border-stone-200 bg-stone-950 p-3 shadow-2xl shadow-stone-300/80">
        <div className="rounded-[36px] bg-white p-4">
          <div className="mx-auto mb-4 h-1.5 w-20 rounded-full bg-stone-200" />
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-400">Reshelved</p>
              <h3 className="mt-1 font-[Work_Sans] text-base font-black text-stone-950">{current.title}</h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0F766E] text-white">
              <i className={`las ${current.icon} text-xl`} />
            </div>
          </div>

          <div className="min-h-[430px] py-5">
            {current.id === 'list' && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#FFF9F0] p-4">
                  <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white text-stone-400">
                    <div className="text-center">
                      <i className="las la-camera text-3xl" />
                      <p className="mt-1 text-xs font-bold">Book photo</p>
                    </div>
                  </div>
                </div>
                {[
                  ['Book title', 'Atomic Habits'],
                  ['Author', 'James Clear'],
                  ['Condition', 'Good'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-stone-200 bg-white p-4">
                    <p className="text-xs font-bold text-stone-400">{label}</p>
                    <p className="mt-1 font-[Work_Sans] text-sm font-black text-stone-950">{value}</p>
                  </div>
                ))}
                <div className="rounded-2xl bg-[#0F766E] py-3 text-center text-sm font-black text-white">Publish Listing</div>
              </div>
            )}

            {current.id === 'choose' && (
              <div className="space-y-4">
                {[
                  ['Sell', 'Set a price and earn cash', 'la-money-bill-wave'],
                  ['Swap', 'Trade for another book', 'la-sync-alt'],
                  ['Donate', 'Give it to a reader', 'la-hand-holding-heart'],
                ].map(([label, text, icon], index) => (
                  <div key={label} className={`rounded-2xl border p-4 ${index === 0 ? 'border-[#0F766E] bg-[#0F766E]/5' : 'border-stone-200 bg-white'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${index === 0 ? 'bg-[#0F766E] text-white' : 'bg-[#FFF9F0] text-[#0F766E]'}`}>
                        <i className={`las ${icon} text-xl`} />
                      </div>
                      <div>
                        <p className="font-[Work_Sans] text-sm font-black text-stone-950">{label}</p>
                        <p className="text-xs text-stone-500">{text}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="rounded-2xl bg-stone-950 py-3 text-center text-sm font-black text-white">Save Choice</div>
              </div>
            )}

            {current.id === 'message' && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#FFF9F0] p-4">
                  <p className="font-[Work_Sans] text-sm font-black text-stone-950">Atomic Habits</p>
                  <p className="mt-1 text-xs text-stone-500">KSh 650 · Westlands</p>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-[78%] rounded-2xl rounded-bl-sm bg-stone-100 px-4 py-3 text-sm text-stone-700">Hi, is this still available?</div>
                </div>
                <div className="flex justify-end">
                  <div className="max-w-[78%] rounded-2xl rounded-br-sm bg-[#0F766E] px-4 py-3 text-sm text-white">Yes. It is still available.</div>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-[78%] rounded-2xl rounded-bl-sm bg-stone-100 px-4 py-3 text-sm text-stone-700">Can we meet near Sarit?</div>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white p-3 text-sm text-stone-400">Type a message...</div>
              </div>
            )}

            {current.id === 'rate' && (
              <div className="space-y-5 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#0F766E]/10 text-[#0F766E]">
                  <i className="las la-check text-3xl" />
                </div>
                <div>
                  <h4 className="font-[Work_Sans] text-xl font-black text-stone-950">Exchange complete</h4>
                  <p className="mt-2 text-sm leading-6 text-stone-500">How was your book trade?</p>
                </div>
                <div className="flex justify-center gap-1 text-3xl text-[#0F766E]">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <i key={star} className="las la-star" />
                  ))}
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white p-4 text-left">
                  <p className="text-xs font-bold text-stone-400">Short review</p>
                  <p className="mt-2 text-sm text-stone-500">Smooth exchange. Book matched the listing.</p>
                </div>
                <div className="rounded-2xl bg-[#0F766E] py-3 text-center text-sm font-black text-white">Submit Rating</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StoryStepCard = ({
  step,
  isActive,
  onClick,
}: {
  step: (typeof storySteps)[number];
  isActive: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full rounded-2xl border bg-white p-6 text-left transition ${
      isActive
        ? 'border-stone-200 shadow-xl shadow-stone-200/70'
        : 'border-stone-100 opacity-55 hover:opacity-80'
    }`}
  >
    <div className={`border-l-4 pl-5 ${isActive ? 'border-[#0F766E]' : 'border-stone-200'}`}>
      <div className="flex items-start gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isActive ? 'bg-[#0F766E] text-white' : 'bg-stone-100 text-stone-400'}`}>
          <i className={`las ${step.icon} text-xl`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-black uppercase tracking-[0.2em] ${isActive ? 'text-[#0F766E]' : 'text-stone-400'}`}>{step.eyebrow}</p>
          <h3 className={`mt-2 font-[Work_Sans] text-[19px] leading-6 text-stone-950 ${isActive ? 'font-black' : 'font-bold'}`}>{step.title}</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">{step.description}</p>
        </div>
      </div>
      <div className="mt-5 h-1 overflow-hidden rounded-full bg-stone-100">
        {isActive && (
          <div
            key={step.id}
            className="h-full rounded-full bg-[#0F766E]"
            style={{ animation: 'story-progress 3000ms linear forwards' }}
          />
        )}
      </div>
    </div>
  </button>
);

const ScrollStorySection = () => {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setActiveStep((current) => (current + 1) % storySteps.length);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [activeStep]);

  const handleStepClick = (index: number) => {
    setActiveStep(index);
  };

  return (
    <section className="bg-white py-16 sm:py-24">
      <style>{`
        @keyframes story-progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-[#0F766E]">Simple Steps</p>
          <h2 className="mt-4 font-[Work_Sans] text-4xl font-black tracking-[-0.03em] text-stone-950 sm:text-6xl">
            How it works
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-stone-600">
            No confusion or delays. Just fast and reliable book trading.
          </p>
        </div>

        <div className="mt-16 grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:items-start">
          <div className="lg:sticky lg:top-28">
            <PhoneMockup activeStep={activeStep} />
          </div>

          <div className="space-y-4">
            {storySteps.map((step, index) => (
              <StoryStepCard
                key={step.id}
                step={step}
                isActive={activeStep === index}
                onClick={() => handleStepClick(index)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const ProcessSection = () => (
  <section className="bg-[#121212] py-16 text-white sm:py-24">
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="font-[Work_Sans] text-2xl font-black tracking-tight">Ready to start?</h2>
            <p className="mt-3 text-sm leading-6 text-white/75">Create your account, find a book, and message the owner. Reshelved keeps the process simple.</p>
            <Link to="/register" className="mt-6 inline-flex rounded-md bg-primary-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-primary-700">
              Join Free
            </Link>
          </div>
        </div>

        <div className="space-y-0">
          {processSteps.map((step, index) => (
            <div key={step.number} className={`grid gap-5 py-8 sm:grid-cols-[64px_1fr] ${index !== processSteps.length - 1 ? 'border-b border-white/10' : ''}`}>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF4E2]/50 text-primary-600">
                <i className={`las ${step.icon} text-3xl`} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-sm font-black text-white">{step.number}</span>
                  <h3 className="font-[Work_Sans] text-xl font-black text-white">{step.title}</h3>
                </div>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12 flex items-center gap-5 rounded-xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-primary-600">
          <i className="las la-shield-alt text-2xl" />
        </div>
        <p className="max-w-2xl text-sm leading-6 text-white/75">
          Your account information and conversations stay inside the platform. You remain in control of what you list, who you message, and when you remove a book from circulation.
        </p>
      </div>
    </div>
  </section>
);

const PlatformFeaturesSection = () => (
  <section className="bg-[#FFF9F0] py-16 sm:py-24">
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <h2 className="mx-auto max-w-4xl text-center font-[Work_Sans] text-4xl font-black leading-tight tracking-[-0.03em] text-stone-950 sm:text-6xl">
        What you get inside
      </h2>

      <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {platformFeatures.map((feature) => (
          <article key={feature.title} className="rounded-2xl bg-white p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white">
                <i className="las la-check text-base" />
              </span>
              <h3 className="font-[Work_Sans] text-[17px] font-black leading-6 text-stone-950">{feature.title}</h3>
            </div>
            <p className="mt-3 text-base leading-7 text-stone-600">{feature.description}</p>
          </article>
        ))}
      </div>
    </div>
  </section>
);

const FooterStartFree = () => (
  <section className="relative bg-[#121212] text-white pt-0 pb-0">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-0 pt-0">
      <div className="border-b border-white/25 pb-20 pt-20">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-12">
          <div className="text-[clamp(64px,11vw,140px)] font-bold leading-[0.92] tracking-tight text-white">
            <div>Start free</div>
            <div className="inline-flex items-center gap-3 sm:gap-8">
              <span>today</span>
              <Link
                to="/register"
                className="w-[clamp(58px,8vw,104px)] h-[clamp(58px,8vw,104px)] rounded-full bg-primary-600 hover:bg-primary-700 flex items-center justify-center transition shrink-0"
                aria-label="Join Reshelved free"
              >
                <i className="las la-arrow-right text-[clamp(26px,3vw,44px)] text-white" />
              </Link>
            </div>
          </div>
          <p className="text-white/80 text-lg max-w-md lg:pb-8">
            Built with feedback from readers across Nairobi. Try Reshelved and see why they love it.
          </p>
        </div>
      </div>
    </div>
  </section>
);

const HowItWorks: React.FC = () => {
  useEffect(() => {
    const previousTitle = document.title;
    const nextTitle = 'How Reshelved Works | Buy, Sell, Swap and Donate Books in Nairobi';
    const description = 'Learn how Reshelved helps readers in Nairobi find affordable second-hand books, verify listings, message sellers, and arrange safe book exchanges.';
    document.title = nextTitle;

    const upsertMeta = (name: string, content: string) => {
      let element = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute('name', name);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    upsertMeta('description', description);
    upsertMeta('robots', 'index, follow');

    const schema = document.createElement('script');
    schema.type = 'application/ld+json';
    schema.id = 'reshelved-how-it-works-faq-schema';
    schema.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    });
    document.head.appendChild(schema);

    return () => {
      document.title = previousTitle;
      document.getElementById('reshelved-how-it-works-faq-schema')?.remove();
    };
  }, []);

  return (
    <div className="overflow-hidden bg-white">
      <section className="relative bg-[#121212] text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:py-28">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-primary-500">How Reshelved works</p>
            <h1 className="mt-5 max-w-3xl font-[Work_Sans] text-5xl font-black leading-[1.02] tracking-[-0.045em] text-white sm:text-7xl">
              Find affordable books in Nairobi without chasing sellers everywhere.
            </h1>
            <p className="mt-7 max-w-2xl text-xl leading-8 text-white/75">
              Search, verify, message, and arrange book exchanges from one structured platform. No scattered posts. No unclear book condition. No wasted calls for books that are already gone.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link to="/browse" className="inline-flex items-center justify-center rounded-md bg-primary-600 px-5 py-3 text-base font-bold text-white transition hover:bg-primary-700">
                Start Finding Books
              </Link>
              <Link to="/create" className="inline-flex items-center justify-center rounded-md border border-white/60 px-5 py-3 text-base font-bold text-white transition hover:bg-white hover:text-stone-950">
                List a Book <i className="las la-angle-right ml-1" />
              </Link>
            </div>
          </div>
          <HeroVisual />
        </div>
      </section>

      <ScrollStorySection />

      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-primary-700">One platform, less friction</p>
              <h2 className="mt-4 max-w-xl font-[Work_Sans] text-4xl font-black leading-tight tracking-[-0.03em] text-stone-950 sm:text-6xl">
                Book hunting should feel organized, not random.
              </h2>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-stone-600">
              Reshelved gives readers a clearer way to find second-hand books, compare available listings, and talk to the owner before making a decision.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="rounded-[22px] border border-stone-200 bg-white p-6 transition hover:-translate-y-1 hover:border-primary-600 hover:shadow-xl">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF4E2]/50 text-primary-600">
                  <i className={`las ${benefit.icon} text-3xl`} />
                </div>
                <h3 className="mt-5 font-[Work_Sans] text-xl font-black text-stone-950">{benefit.title}</h3>
                <p className="mt-3 text-sm leading-6 text-stone-600">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ProcessSection />
      <PlatformFeaturesSection />

      <section className="bg-[#FAFAF9] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-primary-700">What users see</p>
              <h2 className="mt-4 max-w-xl font-[Work_Sans] text-4xl font-black leading-tight tracking-[-0.03em] text-stone-950 sm:text-6xl">
                A clean flow for finding, checking, and messaging.
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-stone-600">
                Each part of the system is designed around the real job readers want done: find the book, check the condition, contact the owner, and agree on the exchange.
              </p>
            </div>
            <div className="rounded-[30px] border border-stone-200 bg-white p-5 shadow-xl shadow-stone-200/60">
              <div className="rounded-3xl bg-stone-50 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-700">Browse books</p>
                    <h3 className="mt-1 font-[Work_Sans] text-2xl font-black text-stone-950">Available near Westlands</h3>
                  </div>
                  <div className="rounded-full bg-white px-3 py-1 text-xs font-bold text-stone-600 shadow-sm">12 results</div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  <MiniBookCard title="Atomic Habits" meta="KSh 650" />
                  <MiniBookCard title="Company Law" meta="Swap" />
                  <MiniBookCard title="The River" meta="Free" />
                </div>
                <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF4E2]/50 text-primary-600">
                      <i className="las la-comments text-2xl" />
                    </div>
                    <div>
                      <p className="font-bold text-stone-950">Message attached to a listing</p>
                      <p className="text-sm text-stone-500">Every conversation stays tied to the book being discussed.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-primary-700">FAQs</p>
            <h2 className="mt-4 font-[Work_Sans] text-4xl font-black tracking-[-0.03em] text-stone-950 sm:text-6xl">
              Questions readers ask before using Reshelved.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-stone-600">
              SEO-friendly answers for buying second-hand books, swapping books, donating books, and arranging safe book exchanges in Nairobi.
            </p>
          </div>

          <div className="mt-12 divide-y divide-stone-200 overflow-hidden rounded-[28px] border border-stone-200 bg-white">
            {faqs.map((faq) => (
              <details key={faq.question} className="group p-6 open:bg-stone-50">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-[Work_Sans] text-lg font-black text-stone-950">
                  {faq.question}
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF4E2]/50 text-primary-600 transition group-open:rotate-45">
                    <i className="las la-plus text-xl" />
                  </span>
                </summary>
                <p className="mt-3 max-w-3xl text-base leading-8 text-stone-600">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <FooterStartFree />
    </div>
  );
};

export default HowItWorks;
