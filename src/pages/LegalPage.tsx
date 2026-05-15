import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const pageDefaults: Record<string, { title: string; content: string }> = {
  'privacy-policy': {
    title: 'Privacy Policy',
    content: '<p>This page will be updated by the Reshelved team.</p>'
  },
  terms: {
    title: 'Terms of Service',
    content: '<p>This page will be updated by the Reshelved team.</p>'
  },
  cookies: {
    title: 'Cookie Policy',
    content: '<p>This page will be updated by the Reshelved team.</p>'
  },
  contact: {
    title: 'Contact',
    content: '<p>This page will be updated by the Reshelved team.</p>'
  }
};

const LegalPage: React.FC<{ slug: string }> = ({ slug }) => {
  const [title, setTitle] = useState(pageDefaults[slug]?.title || 'Page');
  const [content, setContent] = useState(pageDefaults[slug]?.content || '<p>This page is not available yet.</p>');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPage = async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'legalPages', slug));
        if (snap.exists()) {
          const data = snap.data();
          setTitle(data.title || pageDefaults[slug]?.title || 'Page');
          setContent(data.content || pageDefaults[slug]?.content || '');
        } else {
          setTitle(pageDefaults[slug]?.title || 'Page');
          setContent(pageDefaults[slug]?.content || '<p>This page is not available yet.</p>');
        }
      } catch (error) {
        console.error('Could not load legal page:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPage();
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="h-8 w-1/2 rounded bg-stone-200 animate-pulse" />
        <div className="mt-6 space-y-3">
          <div className="h-4 rounded bg-stone-100 animate-pulse" />
          <div className="h-4 rounded bg-stone-100 animate-pulse" />
          <div className="h-4 w-2/3 rounded bg-stone-100 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-4xl font-bold tracking-tight text-stone-950">{title}</h1>
      <article
        className="mt-8 max-w-none text-stone-700 leading-7 [&_p]:mb-4 [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-bold [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-primary-700 [&_a]:font-semibold"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
};

export default LegalPage;
