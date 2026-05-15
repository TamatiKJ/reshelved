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
const getPageDocId = (slug: LegalPageSlug) => `legal-${slug}`;

const AdminLegalPagesEditor: React.FC = () => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [selectedPage, setSelectedPage] = useState<LegalPageSlug>('privacy-policy');
  const [title, setTitle] = useState('Privacy Policy');
  const [content, setContent] = useState(defaultContent);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  const currentLabel = legalPages.find((page) => page.slug === selectedPage)?.label || 'Page';

  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage(text);
    setMessageType(type);
    if (type === 'success') window.setTimeout(() => setMessage(''), 3000);
  };

  useEffect(() => {
    const fetchPage = async () => {
      setLoading(true);
      setMessage('');
      try {
        const snap = await getDoc(doc(db, 'platform', getPageDocId(selectedPage)));
        const nextTitle = snap.exists() ? snap.data().title || currentLabel : currentLabel;
        const nextContent = snap.exists() ? snap.data().content || defaultContent : defaultContent;
        setTitle(nextTitle);
        setContent(nextContent);
        requestAnimationFrame(() => {
          if (editorRef.current) editorRef.current.innerHTML = nextContent;
        });
      } catch (error) {
        console.error('Could not load legal page:', error);
        setTitle(currentLabel);
        setContent(defaultContent);
        requestAnimationFrame(() => {
          if (editorRef.current) editorRef.current.innerHTML = defaultContent;
        });
        showMessage('Could not load this page. Check Firestore read rules for platform documents.', 'error');
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

  const addLink = () => {
    const url = window.prompt('Paste the link URL');
    if (!url) return;
    runCommand('createLink', url);
  };

  const savePage = async () => {
    setSaving(true);
    setMessage('');
    try {
      const html = editorRef.current?.innerHTML || content || defaultContent;
      await setDoc(doc(db, 'platform', getPageDocId(selectedPage)), {
        slug: selectedPage,
        title: title.trim() || currentLabel,
        content: html,
        updatedAt: Date.now()
      }, { merge: true });
      setContent(html);
      showMessage('Page saved.');
    } catch (error: any) {
      console.error('Could not save legal page:', error);
      showMessage(error?.code === 'permission-denied'
        ? 'Could not save this page. Your Firestore rules must allow admins to write platform/legal-* documents.'
        : 'Could not save this page. Check the console for the exact Firebase error.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-visible">
      <div className="sticky top-16 z-20 border-b border-stone-200 bg-white/95 p-4 backdrop-blur">
        <h2 className="text-lg font-bold text-stone-900">Footer Legal Pages</h2>
        <p className="text-sm text-stone-500 mt-1">Edit the title and content that appears on the footer pages.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr]">
        <aside className="border-b border-stone-200 bg-white p-3 lg:sticky lg:top-[145px] lg:self-start lg:border-b-0 lg:border-r">
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
          {message && <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${messageType === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{message}</div>}

          <div className="sticky top-16 z-10 rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-sm backdrop-blur">
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
            <div className="sticky top-[168px] z-10 flex flex-wrap gap-2 rounded-t-xl border border-b-0 border-stone-200 bg-stone-50 p-2">
              <button type="button" onClick={() => runCommand('formatBlock', 'p')} className="cursor-pointer rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm hover:bg-stone-100">Paragraph</button>
              <button type="button" onClick={() => runCommand('formatBlock', 'h2')} className="cursor-pointer rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-stone-100">H2</button>
              <button type="button" onClick={() => runCommand('formatBlock', 'h3')} className="cursor-pointer rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-stone-100">H3</button>
              <button type="button" onClick={() => runCommand('bold')} className="cursor-pointer rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-bold hover:bg-stone-100">B</button>
              <button type="button" onClick={() => runCommand('italic')} className="cursor-pointer rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm italic hover:bg-stone-100">I</button>
              <button type="button" onClick={() => runCommand('underline')} className="cursor-pointer rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm underline hover:bg-stone-100">U</button>
              <button type="button" onClick={() => runCommand('insertUnorderedList')} className="cursor-pointer rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm hover:bg-stone-100">Bullet List</button>
              <button type="button" onClick={() => runCommand('insertOrderedList')} className="cursor-pointer rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm hover:bg-stone-100">Numbered List</button>
              <button type="button" onClick={() => runCommand('formatBlock', 'blockquote')} className="cursor-pointer rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm hover:bg-stone-100">Quote</button>
              <button type="button" onClick={addLink} className="cursor-pointer rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm hover:bg-stone-100">Link</button>
              <button type="button" onClick={() => runCommand('removeFormat')} className="cursor-pointer rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm hover:bg-stone-100">Clear</button>
            </div>
            <div
              ref={editorRef}
              contentEditable={!loading && !saving}
              suppressContentEditableWarning
              onInput={() => setContent(editorRef.current?.innerHTML || '')}
              className="min-h-[520px] rounded-b-xl border border-stone-200 bg-white px-4 py-3 text-sm leading-7 text-stone-700 outline-none focus:border-primary-400 [&_blockquote]:border-l-4 [&_blockquote]:border-stone-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-stone-600 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mt-5 [&_h3]:mb-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6"
            />
          </div>

          <div className="sticky bottom-4 z-10 flex items-center gap-3 rounded-2xl border border-stone-200 bg-white/95 p-3 shadow-sm backdrop-blur">
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
