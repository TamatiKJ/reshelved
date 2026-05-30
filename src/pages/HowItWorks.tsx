import React, { useEffect, useRef, useState } from 'react';
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
    description: 'Add photos, condition, price, and location so readers know what you have before they message you.',
    imageLabel: 'Image placeholder 560 x 460',
  },
  {
    id: 'choose',
    eyebrow: 'Step 2',
    icon: 'la-sync-alt',
    title: 'Choose sell, swap, or donate',
    description: 'Pick how you want the book to move. Sell it for cash, swap it, or give it to a reader who needs it.',
    imageLabel: 'Image placeholder 560 x 460',
  },
  {
    id: 'message',
    eyebrow: 'Step 3',
    icon: 'la-comments',
    title: 'Message and agree',
    description: 'Talk inside Reshelved, confirm the book, and agree on the handover when both sides are ready.',
    imageLabel: 'Image placeholder 560 x 460',
  },
  {
    id: 'rate',
    eyebrow: 'Step 4',
    icon: 'la-star',
    title: 'Rate your exchange',
    description: 'Leave a quick rating after the exchange so other readers know who they can trust.',
    imageLabel: 'Image placeholder 560 x 460',
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

const ScrollPlaceholder = ({ label }: { label: string }) => (
  <div className="relative mx-auto w-full max-w-[560px]">
    <div className="rounded-[22px] border border-stone-200 bg-stone-100 p-4 shadow-xl shadow-stone-200/70">
      <div className="flex aspect-[28/23] items-center justify-center rounded-2xl bg-[#FFF9F0]">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-primary-600 shadow-sm">
            <i className="las la-image text-3xl" />
          </div>
          <p className="mt-4 font-[Work_Sans] text-lg font-black text-stone-950">{label}</p>
        </div>
      </div>
    </div>
    <div className="absolute -bottom-8 right-6 hidden w-52 rounded-2xl border border-stone-200 bg-white p-4 shadow-xl shadow-stone-200/80 sm:block">
      <p className="font-[Work_Sans] text-base font-black text-stone-950">Book listing preview</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div key={item} className="rounded-lg bg-[#FFF9F0] p-2">
            <div className="h-7 rounded-md bg-primary-600/10" />
            <div className="mt-2 h-1.5 w-8 rounded-full bg-stone-200" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const StoryStepCard = ({ step, isActive }: { step: (typeof storySteps)[number]; isActive: boolean }) => (
  <div className="grid gap-5 sm:grid-cols-[56px_1fr]">
    <div className={`flex h-12 w-12 items-center justify-center rounded-xl border transition ${isActive ? 'border-primary-600 bg-primary-600 text-white' : 'border-stone-200 bg-white text-primary-600'}`}>
      <i className={`las ${step.icon} text-2xl`} />
    </div>
    <div>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-700">{step.eyebrow}</p>
      <h3 className="mt-2 font-[Work_Sans] text-xl font-black text-stone-950">{step.title}</h3>
      <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">{step.description}</p>
    </div>
  </div>
);

const ScrollStorySection = () => {
  const [activeStep, setActiveStep] = useState(0);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const stepElements = Array.from(section.querySelectorAll<HTMLElement>('[data-story-step]'));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) return;

        const nextIndex = Number(visible.target.getAttribute('data-story-step'));
        if (!Number.isNaN(nextIndex)) {
          setActiveStep(nextIndex);
        }
      },
      { rootMargin: '-35% 0px -35% 0px', threshold: [0.25, 0.5, 0.75] }
    );

    stepElements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-primary-700">Simple steps</p>
          <h2 className="mt-4 font-[Work_Sans] text-4xl font-black tracking-[-0.03em] text-stone-950 sm:text-6xl">
            Turn unused books into cash, swaps, or free help
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-stone-600">
            List your book once and choose whether to sell, swap, or donate it to another reader.
          </p>
        </div>

        <div className="mt-16 hidden gap-16 lg:grid lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <div className="sticky top-28 pt-8">
            <ScrollPlaceholder label={storySteps[activeStep].imageLabel} />
          </div>

          <div className="relative py-8">
            <div className="absolute bottom-8 left-6 top-8 w-px bg-stone-200" />
            <div className="space-y-0">
              {storySteps.map((step, index) => (
                <div key={step.id} data-story-step={index} className="relative min-h-[280px] scroll-mt-32 pb-12">
                  <div className={`absolute left-6 top-0 h-16 w-px transition ${activeStep === index ? 'bg-primary-600' : 'bg-transparent'}`} />
                  <div className="relative bg-white pl-0">
                    <StoryStepCard step={step} isActive={activeStep === index} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 lg:hidden">
          <ScrollPlaceholder label={storySteps[activeStep].imageLabel} />
          <div className="mt-12 grid grid-cols-2 gap-2 rounded-2xl bg-[#FFF9F0] p-2">
            {storySteps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(index)}
                className={`rounded-xl px-3 py-3 text-xs font-black transition ${activeStep === index ? 'bg-primary-600 text-white' : 'bg-white text-stone-700'}`}
              >
                {step.eyebrow}
              </button>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-5">
            <StoryStepCard step={storySteps[activeStep]} isActive />
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
