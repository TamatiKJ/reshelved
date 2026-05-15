import React, { useEffect, useRef, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

type LegalPageSlug = 'privacy-policy' | 'terms' | 'cookies' | 'contact';

const legalPages: { slug: LegalPageSlug; label: string }[] = [
  { slug: 'privacy-policy', label: 'Privacy Policy' },
  { slug: 'terms', label: 'Terms of Service' },
  { slug: 'cookies', label: 'Cookie Policy' },
  { slug: 'contact', label: 'Contact' }
];

const defaultContent = '<p>Write the page content here.</p>';

const AdminLegalPagesEditor: React.FC = () => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [selectedPage, setSelectedPage] = useState<LegalPageSlug>('privacy-policy');
  const [title, setTitle] = useState('Privacy Policy');
  const [content, setContent] = useState(defaultContent);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const currentLabel = legalPages.find((page) => page.slug === selectedPage)?.label || 'Page';

  useEffect(() => {
    const fetchPage = async () => {
      setLoading(true);
      setMessage('');
      try {
        const snap = await getDoc(doc(db, 'legalPages', selectedPage));
        if (snap.exists()) {
          const data = snap.data();
          setTitle(data.title || currentLabel);
          setContent(data.content || defaultContent);
          if (editorRef.current) editorRef.current.innerHTML = data.content || defaultContent;
        } else {
          setTitle(currentLabel);
          setContent(defaultContent);
          if (editorRef.current) editorRef.current.innerHTML = defaultContent;
        }
      } catch (error) {
        console.error('Could not load legal page:', error);
        setMessage('Could not load this page.');
      } finally {
        setLoading(false);
      }
    };

    fetchPage();
  }, [selectedPage, currentLabel]);

  const runCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    setContent(editorRef.current?.innerHTML || '');
  };

  const savePage = async () => {
    setSaving(true);
    setMessage('');
    try {
      const html = editorRef.current?.innerHTML || content || defaultContent;
      await setDoc(doc(db, 'legalPages', selectedPage), {
        title: title.trim() || currentLabel,
        content: html,
        updatedAt: Date.now()
      }, { merge: true });
      setContent(html);
      setMessage('Page saved.');
      window.setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Could not save legal page:', error);
      setMessage('Could not save this page.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
      <div className="border-b border-stone-200 p-4">
        <h2 className="text-lg font-bold text-stone-900">Footer Legal Pages</h2>
        <p className="text-sm text-stone-500 mt-1">Edit the title and content that appears on the footer pages.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr]">
        <aside className="border-b border-stone-200 p-3 lg:border-b-0 lg:border-r">
          <div className="space-y-1">
            {legalPages.map((page) => (
              <button
                key={page.slug}
                type="button"
                onClick={() => setSelectedPage(page.slug)}
                className={`w-full cursor-pointer rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${selectedPage === page.slug ? 'bg-primary-50 text-primary-700' : 'text-stone-600 hover:bg-stone-50'}`}
              >
                {page.label}
              </button>
            ))}
          </div>
        </aside>

        <div className="p-4 sm:p-5 space-y-4">
          {message && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{message}</div>}

          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1">Page Title</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={loading || saving}
              className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-primary-400 disabled:bg-stone-50"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-2">Page Content</label>
            <div className="flex flex-wrap gap-2 rounded-t-xl border border-b-0 border-stone-200 bg-stone-50 p-2">
              <button type="button" onClick={() => runCommand('bold')} className="cursor-pointer rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-bold hover:bg-stone-100">B</button>
              <button type="button" onClick={() => runCommand('italic')} className="cursor-pointer rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm italic hover:bg-stone-100">I</button>
              <button type="button" onClick={() => runCommand('insertUnorderedList')} className="cursor-pointer rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm hover:bg-stone-100">Bullet List</button>
              <button type="button" onClick={() => runCommand('formatBlock', 'h2')} className="cursor-pointer rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm hover:bg-stone-100">H2</button>
              <button type="button" onClick={() => runCommand('formatBlock', 'p')} className="cursor-pointer rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm hover:bg-stone-100">Paragraph</button>
            </div>
            <div
              ref={editorRef}
              contentEditable={!loading && !saving}
              suppressContentEditableWarning
              onInput={() => setContent(editorRef.current?.innerHTML || '')}
              className="min-h-[320px] rounded-b-xl border border-stone-200 bg-white px-4 py-3 text-sm leading-7 text-stone-700 outline-none focus:border-primary-400 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={savePage}
              disabled={loading || saving}
              className="cursor-pointer rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Page'}
            </button>
            <a href={`/${selectedPage}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-primary-700 hover:text-primary-800">
              Preview page
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLegalPagesEditor;
