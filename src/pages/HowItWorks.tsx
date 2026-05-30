import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

const steps = [
  {
    number: '01',
    title: 'Search for the book you need',
    description: 'Find books by title, author, category, condition, exchange type, and Nairobi location without digging through scattered WhatsApp groups or social media posts.',
    imageTitle: 'Smart book search',
    imageDescription: 'Filter listings by location, price, condition, and category.',
  },
  {
    number: '02',
    title: 'Check the listing before you message',
    description: 'Review real photos, book condition, seller details, price, and whether the owner wants to sell, swap, or donate before you start a conversation.',
    imageTitle: 'Clear listing details',
    imageDescription: 'See the book, seller, condition, and exchange option first.',
  },
  {
    number: '03',
    title: 'Message and arrange the exchange',
    description: 'Use the in-app chat to ask questions, agree on terms, and arrange the safest offline handover with more confidence and less back-and-forth.',
    imageTitle: 'Organized buyer chat',
    imageDescription: 'Keep exchange conversations tied to each book listing.',
  },
];

const benefits = [
  {
    icon: 'la-user-check',
    title: 'Verified accounts',
    description: 'Users create accounts before listing or messaging, which improves accountability across the platform.',
  },
  {
    icon: 'la-tags',
    title: 'Clear book condition labels',
    description: 'Every listing shows the condition upfront, so buyers know what they are considering before contacting the owner.',
  },
  {
    icon: 'la-map-marker-alt',
    title: 'Nairobi location search',
    description: 'Search books by area to find options closer to where you live, study, or work.',
  },
  {
    icon: 'la-comments',
    title: 'Built-in messaging',
    description: 'Ask questions and arrange swaps, sales, or donations without losing conversations across different apps.',
  },
  {
    icon: 'la-star',
    title: 'Ratings and reviews',
    description: 'Seller feedback helps readers make better decisions and encourages responsible exchange behaviour.',
  },
  {
    icon: 'la-recycle',
    title: 'Reuse instead of waste',
    description: 'Books stay in circulation longer, helping readers save money while reducing unused books on shelves.',
  },
];

const faqs = [
  {
    question: 'How does Reshelved work?',
    answer: 'Reshelved lets readers in Nairobi list, search, sell, swap, or donate physical books through a structured peer-to-peer platform. You search for a book, check the listing details, message the owner, and arrange the exchange offline.',
  },
  {
    question: 'Is Reshelved free to use?',
    answer: 'Yes. Readers can create an account, browse available books, list books, and message other users. If a seller has priced a book, the payment or handover arrangement is handled directly between the users.',
  },
  {
    question: 'Can I sell, swap, and donate books on Reshelved?',
    answer: 'Yes. When creating a listing, you can choose whether you want to sell the book, swap it for another book, or donate it for free.',
  },
  {
    question: 'Does Reshelved deliver books in Nairobi?',
    answer: 'No. Reshelved does not handle delivery at this stage. Buyers and sellers use the platform to discover books and communicate, then agree on their own pickup, meet-up, or delivery arrangement.',
  },
  {
    question: 'How do I know if a seller is trustworthy?',
    answer: 'Reshelved improves trust through user accounts, clear listing details, real book photos, condition labels, in-app messaging, ratings, reviews, and reporting tools. You should still meet in safe public places and confirm the book before completing an exchange.',
  },
  {
    question: 'Can I search for second-hand books near me in Nairobi?',
    answer: 'Yes. Reshelved allows users to search and filter books by Nairobi locations, making it easier to find affordable second-hand books near your preferred area.',
  },
  {
    question: 'What happens when my book listing expires?',
    answer: 'Listings stay active for the platform’s set listing period. After expiry, the listing is no longer shown as active, but you can create or refresh listings when you still want to make the book available.',
  },
  {
    question: 'What types of books can I find on Reshelved?',
    answer: 'You can find academic books, novels, business books, self-development books, children’s books, and other physical books listed by readers, students, and book owners in Nairobi.',
  },
];

const StepMockup = ({ index, title, description }: { index: number; title: string; description: string }) => {
  if (index === 0) {
    return (
      <div className="relative overflow-hidden rounded-[28px] border border-stone-200 bg-white p-5 shadow-xl shadow-stone-200/70">
        <div className="rounded-2xl bg-[#FFF4E2] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-700">Search dashboard</p>
              <h3 className="mt-1 font-[Work_Sans] text-xl font-bold text-stone-950">Find books faster</h3>
            </div>
            <div className="rounded-full bg-white px-3 py-1 text-xs font-bold text-primary-700 shadow-sm">Nairobi</div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-primary-100 bg-white px-3 py-2.5 text-sm font-semibold text-stone-500">
            <i className="las la-search text-xl text-stone-700" />
            Search by title, author, or category
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {['Atomic Habits', 'Company Law', 'The River'].map((book, itemIndex) => (
            <div key={book} className="rounded-2xl border border-stone-200 bg-white p-3">
              <div className={`${itemIndex === 0 ? 'bg-orange-100' : itemIndex === 1 ? 'bg-amber-100' : 'bg-emerald-50'} flex aspect-[4/5] items-center justify-center rounded-xl`}>
                <i className="las la-book text-3xl text-primary-700" />
              </div>
              <p className="mt-3 truncate text-xs font-bold text-stone-950">{book}</p>
              <p className="mt-1 text-[11px] font-semibold text-stone-500">Good · Westlands</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {['Swap', 'For Sale', 'Good condition'].map((tag) => <span key={tag} className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700">{tag}</span>)}
        </div>
      </div>
    );
  }

  if (index === 1) {
    return (
      <div className="relative overflow-hidden rounded-[28px] border border-stone-200 bg-white p-5 shadow-xl shadow-stone-200/70">
        <div className="grid grid-cols-[0.9fr_1.1fr] gap-4">
          <div className="flex min-h-[250px] items-center justify-center rounded-3xl bg-[#FFF4E2]">
            <i className="las la-book-open text-7xl text-primary-700" />
          </div>
          <div className="space-y-4">
            <div>
              <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-700">Good condition</span>
              <h3 className="mt-3 font-[Work_Sans] text-2xl font-bold text-stone-950">Clean listing details</h3>
              <p className="mt-2 text-sm leading-6 text-stone-500">Photos, location, exchange type, and seller information are visible before you contact anyone.</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">A</div>
                <div>
                  <p className="text-sm font-bold text-stone-950">Listed by Amina</p>
                  <p className="text-xs font-semibold text-amber-500">★★★★★ <span className="text-stone-500">(8 reviews)</span></p>
                </div>
              </div>
            </div>
            <button className="w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white">Contact Seller</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-stone-200 bg-white p-5 shadow-xl shadow-stone-200/70">
      <div className="rounded-3xl border border-stone-200 bg-stone-50">
        <div className="flex items-center gap-3 border-b border-stone-200 bg-white p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 font-bold text-primary-700">B</div>
          <div>
            <p className="text-sm font-bold text-stone-950">Brian</p>
            <p className="text-xs text-primary-700">Re: Introduction to Algorithms</p>
          </div>
        </div>
        <div className="space-y-3 p-4">
          <div className="max-w-[78%] rounded-2xl rounded-bl-md bg-white px-4 py-3 text-sm text-stone-700 shadow-sm">Is the book still available near CBD?</div>
          <div className="ml-auto max-w-[78%] rounded-2xl rounded-br-md bg-primary-600 px-4 py-3 text-sm text-white">Yes. I can meet tomorrow afternoon.</div>
          <div className="rounded-2xl border border-stone-200 bg-white p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFF4E2]"><i className="las la-book text-2xl text-primary-700" /></div>
              <div>
                <p className="text-sm font-bold text-stone-950">Book attached to chat</p>
                <p className="text-xs text-stone-500">Sale · KSh 800 · CBD</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-white p-2">
            <div className="flex-1 rounded-xl bg-stone-100 px-4 py-2 text-sm text-stone-400">Type a message...</div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white"><i className="las la-paper-plane" /></div>
          </div>
        </div>
      </div>
    </div>
  );
};

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
    <div className="overflow-hidden bg-[#FAFAF9]">
      <section className="relative border-b border-stone-200 bg-white">
        <div className="absolute left-0 top-0 h-72 w-72 rounded-full bg-[#FFF4E2] blur-3xl" />
        <div className="absolute right-0 top-24 h-80 w-80 rounded-full bg-orange-100/70 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:py-24">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-primary-700">How Reshelved works</p>
            <h1 className="mt-4 max-w-3xl font-[Work_Sans] text-4xl font-black leading-[1.05] tracking-[-0.04em] text-stone-950 sm:text-6xl lg:text-7xl">
              Find affordable books in Nairobi without chasing sellers everywhere.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-600">
              Reshelved helps you search, verify, message, and arrange book exchanges from one clean platform. No scattered posts. No unclear book condition. No wasted calls for books that are already gone.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/browse" className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-primary-600/20 transition hover:bg-primary-700">
                Start Finding Books
              </Link>
              <Link to="/create" className="inline-flex items-center justify-center rounded-xl border border-stone-300 bg-white px-6 py-3.5 text-base font-bold text-stone-950 transition hover:bg-stone-50">
                List a Book
              </Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {['Search by location', 'Sell, swap, or donate', 'Message before meeting'].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold text-stone-700">
                  <i className="las la-check-circle text-xl text-primary-600" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute -left-5 top-10 hidden rounded-2xl bg-primary-600 px-4 py-2 text-sm font-bold text-white shadow-xl lg:block">Books near you</div>
            <StepMockup index={0} title="Smart book search" description="Browse clean listings." />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-primary-700">Simple process</p>
          <h2 className="mt-3 font-[Work_Sans] text-3xl font-black tracking-[-0.03em] text-stone-950 sm:text-5xl">From search to exchange in three clear steps.</h2>
          <p className="mt-4 text-lg leading-8 text-stone-600">The page flow is built for readers who want fast answers: what is available, who listed it, what condition it is in, and how to contact the owner.</p>
        </div>

        <div className="mt-14 space-y-16">
          {steps.map((step, index) => (
            <div key={step.number} className={`grid items-center gap-8 lg:grid-cols-2 ${index % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''}`}>
              <div className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF4E2] text-lg font-black text-primary-700">{step.number}</span>
                <h3 className="mt-5 font-[Work_Sans] text-2xl font-black tracking-[-0.02em] text-stone-950 sm:text-4xl">{step.title}</h3>
                <p className="mt-4 text-base leading-8 text-stone-600">{step.description}</p>
                <div className="mt-6 rounded-2xl bg-stone-50 p-4">
                  <p className="text-sm font-black text-stone-950">Figma image idea</p>
                  <p className="mt-1 text-sm leading-6 text-stone-600">Create a SaaS-style screen called <strong>{step.imageTitle}</strong>. {step.imageDescription}</p>
                </div>
              </div>
              <StepMockup index={index} title={step.imageTitle} description={step.imageDescription} />
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-primary-700">Why readers use it</p>
              <h2 className="mt-3 font-[Work_Sans] text-3xl font-black tracking-[-0.03em] text-stone-950 sm:text-5xl">A cleaner way to buy and exchange second-hand books.</h2>
              <p className="mt-4 text-lg leading-8 text-stone-600">Reshelved is not a noisy general marketplace. It is built specifically around book discovery, listing clarity, trust, and local reader-to-reader exchange.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {benefits.map((benefit) => (
                <div key={benefit.title} className="rounded-3xl border border-stone-200 bg-[#FAFAF9] p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF4E2] text-primary-700">
                    <i className={`las ${benefit.icon} text-2xl`} />
                  </div>
                  <h3 className="mt-4 font-[Work_Sans] text-xl font-black text-stone-950">{benefit.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="text-center">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-primary-700">FAQs</p>
          <h2 className="mt-3 font-[Work_Sans] text-3xl font-black tracking-[-0.03em] text-stone-950 sm:text-5xl">Questions readers search before using Reshelved.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-stone-600">Clear answers for buying second-hand books, swapping books, donating books, and arranging safe exchanges in Nairobi.</p>
        </div>
        <div className="mt-10 divide-y divide-stone-200 overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-sm">
          {faqs.map((faq) => (
            <details key={faq.question} className="group p-6 open:bg-stone-50">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-[Work_Sans] text-lg font-black text-stone-950">
                {faq.question}
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF4E2] text-primary-700 transition group-open:rotate-45"><i className="las la-plus text-xl" /></span>
              </summary>
              <p className="mt-3 max-w-3xl text-base leading-8 text-stone-600">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:pb-24">
        <div className="relative overflow-hidden rounded-[34px] bg-primary-700 px-6 py-14 text-center shadow-xl shadow-primary-700/20 sm:px-10">
          <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-[#F7AF31]/30 blur-2xl" />
          <div className="relative mx-auto max-w-3xl">
            <h2 className="font-[Work_Sans] text-3xl font-black tracking-[-0.03em] text-white sm:text-5xl">Your next book might already be sitting on someone else’s shelf.</h2>
            <p className="mt-4 text-lg leading-8 text-orange-50">Browse available books in Nairobi or list a book someone else needs today.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/browse" className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3.5 text-base font-bold text-primary-700 transition hover:bg-orange-50">Browse Available Books</Link>
              <Link to="/create" className="inline-flex items-center justify-center rounded-xl border border-white/30 px-6 py-3.5 text-base font-bold text-white transition hover:bg-white/10">List Your Book</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HowItWorks;
