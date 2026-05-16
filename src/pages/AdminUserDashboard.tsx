import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Link } from 'react-router-dom';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import AdminLegalPagesEditor from '../components/AdminLegalPagesEditor';
import type { Listing, Report, UserProfile } from '../types';

type AdminView = 'overview' | 'listings' | 'users' | 'reports' | 'posts' | 'newPost' | 'categories' | 'tags' | 'settings' | 'legalPages';
type ListingStatusFilter = 'active' | 'inactive' | 'all';

type BlogPost = {
  id: string;
  title: string;
  content: string;
  authorName: string;
  seoTitle: string;
  slug: string;
  seoDescription: string;
  featuredImage: string;
  category: string;
  tags: string;
  status: 'published' | 'draft';
  createdAt: number;
  publishedAt?: number;
};

const isUserOnline = (user: UserProfile) => Boolean(user.online) && Date.now() - (user.lastSeen || 0) < 2 * 60 * 1000;
const formatDate = (timestamp?: number) => timestamp ? new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Not recorded';
const normalizeImages = (images?: unknown): string[] => Array.isArray(images) ? images.filter((image): image is string => typeof image === 'string' && image.trim().length > 0) : [];
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 75);

const AdminUserDashboard: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<AdminView>('overview');
  const [listingStatus, setListingStatus] = useState<ListingStatusFilter>('active');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [search, setSearch] = useState('');
  const [settings, setSettings] = useState({ listingDays: '10', siteTitle: 'Reshelved', siteDescription: '', siteFavicon: '' });
  const [post, setPost] = useState({ title: '', seoTitle: '', slug: '', seoDescription: '', featuredImage: '', category: '', tags: '' });
  const [savingPost, setSavingPost] = useState(false);
  const [uploadingFeaturedImage, setUploadingFeaturedImage] = useState(false);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  };

  const fetchAdminData = async () => {
    if (!userProfile?.isAdmin) return;
    setLoading(true);
    try {
      const [listingSnap, reportSnap, userSnap, postSnap, settingsSnap] = await Promise.all([
        getDocs(collection(db, 'listings')),
        getDocs(collection(db, 'reports')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'blogPosts')).catch(() => null),
        getDoc(doc(db, 'platform', 'settings')).catch(() => null)
      ]);

      const listingItems: Listing[] = [];
      listingSnap.forEach((item) => listingItems.push({ id: item.id, ...item.data() } as Listing));
      listingItems.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setListings(listingItems);

      const reportItems: Report[] = [];
      reportSnap.forEach((item) => reportItems.push({ id: item.id, ...item.data() } as Report));
      reportItems.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setReports(reportItems);

      const userItems: UserProfile[] = [];
      userSnap.forEach((item) => userItems.push({ uid: item.id, ...item.data() } as UserProfile));
      userItems.sort((a, b) => Number(Boolean(b.isAdmin)) - Number(Boolean(a.isAdmin)) || (a.displayName || '').localeCompare(b.displayName || ''));
      setUsers(userItems);

      const postItems: BlogPost[] = [];
      postSnap?.forEach((item) => postItems.push({ id: item.id, ...item.data() } as BlogPost));
      postItems.sort((a, b) => (b.publishedAt || b.createdAt || 0) - (a.publishedAt || a.createdAt || 0));
      setPosts(postItems);

      if (settingsSnap?.exists()) {
        const data = settingsSnap.data();
        setSettings({ listingDays: String(data.listingDays || 10), siteTitle: data.siteTitle || 'Reshelved', siteDescription: data.siteDescription || '', siteFavicon: data.siteFavicon || '' });
      }
    } catch (error) {
      console.error('Admin dashboard failed to load:', error);
      showToast('Admin data failed to load. Check Firestore rules.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAdminData(); }, [userProfile?.isAdmin]);
  useEffect(() => { setSearch(''); }, [view]);

  const activeListings = useMemo(() => listings.filter((listing) => listing.active && listing.expiresAt > Date.now()), [listings]);
  const inactiveListings = useMemo(() => listings.filter((listing) => !listing.active || listing.expiresAt <= Date.now()), [listings]);
  const openReports = useMemo(() => reports.filter((report) => !report.resolved), [reports]);
  const onlineUsers = useMemo(() => users.filter(isUserOnline), [users]);
  const admins = useMemo(() => users.filter((user) => user.isAdmin), [users]);

  const listedByStatus = listingStatus === 'active' ? activeListings : listingStatus === 'inactive' ? inactiveListings : listings;
  const filteredListings = listedByStatus.filter((listing) => [listing.title, listing.author, listing.userName, listing.location, listing.category, listing.active ? 'active' : 'inactive'].join(' ').toLowerCase().includes(search.toLowerCase()));
  const filteredUsers = users.filter((user) => [user.displayName, user.email, user.location, user.isAdmin ? 'admin' : 'user'].join(' ').toLowerCase().includes(search.toLowerCase()));
  const filteredReports = reports.filter((report) => [report.targetName, report.reporterName, report.reason, report.details, report.resolved ? 'resolved' : 'open'].join(' ').toLowerCase().includes(search.toLowerCase()));
  const filteredPosts = posts.filter((item) => [item.title, item.authorName, item.category, item.tags].join(' ').toLowerCase().includes(search.toLowerCase()));

  const runCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  };

  const addImageToPost = () => {
    const imageUrl = window.prompt('Paste the image URL');
    if (imageUrl) runCommand('insertImage', imageUrl);
  };

  const uploadFeaturedImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file.');
      return;
    }
    setUploadingFeaturedImage(true);
    try {
      const imageRef = ref(storage, `blog/featured/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`);
      await uploadBytes(imageRef, file, { contentType: file.type });
      const imageUrl = await getDownloadURL(imageRef);
      setPost((current) => ({ ...current, featuredImage: imageUrl }));
      showToast('Featured image uploaded.');
    } catch (error) {
      console.error('Featured image upload failed:', error);
      showToast('Featured image failed to upload. Check Storage rules.');
    } finally {
      setUploadingFeaturedImage(false);
    }
  };

  const savePost = async (status: 'published' | 'draft') => {
    setSavingPost(true);
    try {
      const title = post.title.trim();
      if (!title) throw new Error('Add a post title first.');
      const payload = { title, content: editorRef.current?.innerHTML || '', authorId: currentUser?.uid || '', authorName: userProfile?.displayName || currentUser?.displayName || 'Admin', seoTitle: post.seoTitle.trim() || title, slug: slugify(post.slug || title), seoDescription: post.seoDescription.trim(), featuredImage: post.featuredImage.trim(), category: post.category.trim(), tags: post.tags.trim(), status, createdAt: Date.now(), publishedAt: status === 'published' ? Date.now() : null };
      await addDoc(collection(db, 'blogPosts'), payload);
      setPost({ title: '', seoTitle: '', slug: '', seoDescription: '', featuredImage: '', category: '', tags: '' });
      if (editorRef.current) editorRef.current.innerHTML = '';
      showToast(status === 'published' ? 'Post published.' : 'Draft saved.');
      setView('posts');
      fetchAdminData();
    } catch (error: any) {
      showToast(error?.message || 'Post could not be saved.');
    } finally {
      setSavingPost(false);
    }
  };

  const saveSettings = async () => {
    await setDoc(doc(db, 'platform', 'settings'), { listingDays: Number(settings.listingDays) || 10, siteTitle: settings.siteTitle, siteDescription: settings.siteDescription, siteFavicon: settings.siteFavicon, updatedAt: Date.now() }, { merge: true });
    showToast('Platform settings saved.');
  };

  const toggleListing = async (listing: Listing) => {
    const nextActive = !listing.active;
    await updateDoc(doc(db, 'listings', listing.id), { active: nextActive });
    setListings((current) => current.map((item) => item.id === listing.id ? { ...item, active: nextActive } : item));
    showToast(nextActive ? 'Listing activated.' : 'Listing deactivated.');
  };

  const deleteListing = async (listing: Listing) => {
    if (!confirm(`Delete “${listing.title}” permanently?`)) return;
    await deleteDoc(doc(db, 'listings', listing.id));
    setListings((current) => current.filter((item) => item.id !== listing.id));
    showToast('Listing deleted.');
  };

  const resolveReport = async (report: Report) => {
    await updateDoc(doc(db, 'reports', report.id), { resolved: true });
    setReports((current) => current.map((item) => item.id === report.id ? { ...item, resolved: true } : item));
    showToast('Report resolved.');
  };

  const updateUser = async (user: UserProfile, updates: Partial<UserProfile>, message: string) => {
    await setDoc(doc(db, 'users', user.uid), updates, { merge: true });
    setUsers((current) => current.map((item) => item.uid === user.uid ? { ...item, ...updates } : item));
    showToast(message);
  };

  if (!userProfile?.isAdmin) return <div className="max-w-4xl mx-auto px-4 py-16 text-center"><h2 className="text-xl font-bold text-stone-800">Access Denied</h2><p className="text-stone-500 mt-2">You do not have admin privileges.</p></div>;

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {toast && <div className="fixed top-6 right-6 z-50 rounded-xl bg-stone-950 px-5 py-3 text-sm font-semibold text-white shadow-xl">{toast}</div>}
      <div className="grid w-full flex-1 grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[270px_1fr] lg:px-6">
        <aside className="rounded-2xl border border-stone-200 bg-white p-3 lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <SideItem icon="la-home" label="Overview" active={view === 'overview'} onClick={() => setView('overview')} />
          <SideItem icon="la-book" label="Active listings" count={activeListings.length} active={view === 'listings'} onClick={() => setView('listings')} />
          <SideItem icon="la-users" label="Users" count={users.length} active={view === 'users'} onClick={() => setView('users')} />
          <SideItem icon="la-flag" label="Reports" count={openReports.length} active={view === 'reports'} onClick={() => setView('reports')} />
          <SectionLabel label="Blog" />
          <SideItem icon="la-newspaper" label="All Posts" active={view === 'posts'} onClick={() => setView('posts')} />
          <SideItem icon="la-plus-circle" label="Add New" active={view === 'newPost'} onClick={() => setView('newPost')} />
          <SideItem icon="la-folder" label="Categories" active={view === 'categories'} onClick={() => setView('categories')} />
          <SideItem icon="la-tags" label="Tags" active={view === 'tags'} onClick={() => setView('tags')} />
          <SectionLabel label="Legal" />
          <SideItem icon="la-file-contract" label="Legal Pages" active={view === 'legalPages'} onClick={() => setView('legalPages')} />
          <SectionLabel label="Platform" />
          <SideItem icon="la-cog" label="Settings" active={view === 'settings'} onClick={() => setView('settings')} />
        </aside>

        <main className="min-w-0">
          <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-bold text-stone-950">{getViewTitle(view)}</h2>
            <button onClick={fetchAdminData} className="cursor-pointer rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"><i className="las la-redo-alt mr-1" />Refresh</button>
          </div>
          {loading ? <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-stone-500">Loading dashboard...</div> : renderContent()}
        </main>
      </div>
      <AdminFooter />
    </div>
  );

  function renderContent() {
    if (view === 'overview') return <><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"><Stat label="Active listings" value={activeListings.length} icon="la-book" tone="bg-blue-50 text-[#1665CC] border-blue-100" /><Stat label="Users" value={users.length} icon="la-users" tone="bg-emerald-50 text-emerald-700 border-emerald-100" /><Stat label="Open reports" value={openReports.length} icon="la-flag" tone="bg-red-50 text-red-700 border-red-100" /><Stat label="Online users" value={onlineUsers.length} icon="la-wifi" tone="bg-amber-50 text-amber-700 border-amber-100" /></div><div className="mt-6 space-y-6"><Panel title="Recent listings"><ListingTable items={activeListings.slice(0, 8)} compact /></Panel><Panel title="Recent reports"><ReportList items={openReports.slice(0, 8)} /></Panel></div></>;
    if (view === 'listings') return <Panel title="Listings"><div className="mb-4 flex flex-wrap items-center gap-2"><StatusFilter label="Active" count={activeListings.length} active={listingStatus === 'active'} onClick={() => setListingStatus('active')} /><StatusFilter label="Inactive" count={inactiveListings.length} active={listingStatus === 'inactive'} onClick={() => setListingStatus('inactive')} /><StatusFilter label="All" count={listings.length} active={listingStatus === 'all'} onClick={() => setListingStatus('all')} /></div><SearchBar value={search} setValue={setSearch} placeholder="Search listings..." /><ListingTable items={filteredListings} onToggle={toggleListing} onDelete={deleteListing} /></Panel>;
    if (view === 'users') return <Panel title="Users"><div className="mb-3 flex flex-wrap gap-2 text-sm"><span className="font-semibold text-stone-700">All <span className="text-stone-400">({users.length})</span></span><span className="text-stone-300">|</span><span className="font-semibold text-[#1665CC]">Admins <span className="text-stone-400">({admins.length})</span></span></div><SearchBar value={search} setValue={setSearch} placeholder="Search users..." /><UserTable items={filteredUsers} currentUserId={currentUser?.uid} onUpdate={updateUser} /></Panel>;
    if (view === 'reports') return <Panel title="Reports"><SearchBar value={search} setValue={setSearch} placeholder="Search reports..." /><ReportList items={filteredReports} onResolve={resolveReport} /></Panel>;
    if (view === 'posts') return <Panel title="All Posts"><SearchBar value={search} setValue={setSearch} placeholder="Search posts..." /><PostTable items={filteredPosts} /></Panel>;
    if (view === 'newPost') return <PostEditor />;
    if (view === 'categories') return <SimpleTaxonomy title="Categories" collectionName="blogCategories" />;
    if (view === 'tags') return <SimpleTaxonomy title="Tags" collectionName="blogTags" />;
    if (view === 'settings') return <SettingsPanel />;
    if (view === 'legalPages') return <AdminLegalPagesEditor />;
    return null;
  }

  function PostEditor() {
    return <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]"><section className="rounded-2xl border border-stone-200 bg-white p-5"><input value={post.title} onChange={(e) => setPost((current) => ({ ...current, title: e.target.value, seoTitle: current.seoTitle || e.target.value, slug: current.slug || slugify(e.target.value) }))} placeholder="Title" className="w-full border-0 border-b border-stone-200 px-0 py-4 text-4xl font-bold outline-none focus:border-[#1665CC]" /><div className="mt-5 flex flex-wrap gap-2 border-b border-stone-200 pb-3"><EditorButton label="B" onClick={() => runCommand('bold')} /><EditorButton label="I" onClick={() => runCommand('italic')} /><EditorButton label="H2" onClick={() => runCommand('formatBlock', 'h2')} /><EditorButton label="List" onClick={() => runCommand('insertUnorderedList')} /><EditorButton label="Image" onClick={addImageToPost} /></div><div ref={editorRef} contentEditable suppressContentEditableWarning className="min-h-[540px] px-1 py-6 text-lg leading-8 text-stone-800 outline-none empty:before:text-stone-400 empty:before:content-['Start_writing_your_post...'] [&_h2]:mt-8 [&_h2]:text-3xl [&_h2]:font-bold [&_img]:my-6 [&_img]:rounded-2xl" /></section><aside className="space-y-4"><Panel title="Publish"><button disabled={savingPost} onClick={() => savePost('published')} className="w-full cursor-pointer rounded-full bg-stone-950 px-5 py-3 text-sm font-bold text-white hover:bg-stone-800 disabled:opacity-50">Publish</button><button disabled={savingPost} onClick={() => savePost('draft')} className="mt-2 w-full cursor-pointer rounded-full border border-stone-200 px-5 py-3 text-sm font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-50">Save draft</button></Panel><Panel title="Featured image"><label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-center text-sm font-semibold text-stone-600 hover:border-[#1665CC] hover:bg-[#1665CC]/5"><input type="file" accept="image/*" onChange={uploadFeaturedImage} className="hidden" />{uploadingFeaturedImage ? 'Uploading...' : 'Upload featured image'}</label>{post.featuredImage && <img src={post.featuredImage} alt="Featured preview" className="mt-3 aspect-video w-full rounded-xl object-cover" />}</Panel><Panel title="SEO Settings"><SeoInput label="SEO title" value={post.seoTitle} limit={60} onChange={(value) => setPost((current) => ({ ...current, seoTitle: value }))} /><SeoInput label="URL slug" value={post.slug} limit={75} onChange={(value) => setPost((current) => ({ ...current, slug: slugify(value) }))} /><SeoTextArea label="SEO meta description" value={post.seoDescription} limit={160} onChange={(value) => setPost((current) => ({ ...current, seoDescription: value }))} /></Panel><Panel title="Organization"><input value={post.category} onChange={(e) => setPost((current) => ({ ...current, category: e.target.value }))} placeholder="Category" className="admin-input" /><input value={post.tags} onChange={(e) => setPost((current) => ({ ...current, tags: e.target.value }))} placeholder="Tags, comma separated" className="admin-input mt-3" /></Panel></aside></div>;
  }

  function SettingsPanel() {
    return <Panel title="Platform settings"><div className="grid max-w-2xl gap-4"><label className="admin-label">How long each listing lasts<input value={settings.listingDays} onChange={(e) => setSettings((current) => ({ ...current, listingDays: e.target.value }))} className="admin-input mt-1" /></label><label className="admin-label">Site title<input value={settings.siteTitle} onChange={(e) => setSettings((current) => ({ ...current, siteTitle: e.target.value }))} className="admin-input mt-1" /></label><label className="admin-label">Site favicon<input value={settings.siteFavicon} onChange={(e) => setSettings((current) => ({ ...current, siteFavicon: e.target.value }))} className="admin-input mt-1" /></label><label className="admin-label">Site description<textarea value={settings.siteDescription} onChange={(e) => setSettings((current) => ({ ...current, siteDescription: e.target.value }))} className="admin-input mt-1 min-h-[110px]" /></label><button onClick={saveSettings} className="w-fit cursor-pointer rounded-xl bg-[#1665CC] px-5 py-3 text-sm font-bold text-white">Save settings</button></div></Panel>;
  }
};

const getViewTitle = (view: AdminView) => ({ overview: 'Overview', listings: 'Listings', users: 'Users', reports: 'Reports', posts: 'All Posts', newPost: 'Add New Post', categories: 'Categories', tags: 'Tags', settings: 'Platform settings', legalPages: 'Legal Pages' }[view]);
const SectionLabel: React.FC<{ label: string }> = ({ label }) => <div className="mt-4 px-3 text-[13px] font-bold uppercase tracking-[2px] text-[#1665CC]">{label}</div>;
const SideItem: React.FC<{ icon: string; label: string; active: boolean; onClick: () => void; count?: number }> = ({ icon, label, active, onClick, count }) => <button onClick={onClick} className={`mt-1 flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${active ? 'bg-stone-100 text-stone-950' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-950'}`}><span><i className={`las ${icon} mr-2 text-lg text-stone-400`} />{label}</span>{count !== undefined && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">{count}</span>}</button>;
const Stat: React.FC<{ label: string; value: number; icon: string; tone: string }> = ({ label, value, icon, tone }) => <div className={`rounded-2xl border bg-white p-5 ${tone}`}><i className={`las ${icon} text-2xl`} /><p className="mt-4 text-3xl font-bold text-stone-950">{value}</p><p className="text-[13px] font-bold uppercase tracking-[2px] text-stone-500">{label}</p></div>;
const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => <section className="rounded-2xl border border-stone-200 bg-white p-5"><h3 className="mb-4 text-lg font-bold text-stone-950">{title}</h3>{children}</section>;
const SearchBar: React.FC<{ value: string; setValue: (value: string) => void; placeholder: string }> = ({ value, setValue, placeholder }) => <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="mb-4 w-full rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10" />;
const StatusFilter: React.FC<{ label: string; count: number; active: boolean; onClick: () => void }> = ({ label, count, active, onClick }) => <button onClick={onClick} className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-bold transition ${active ? 'border-[#1665CC] bg-[#1665CC]/10 text-[#1665CC]' : 'border-stone-200 text-stone-600 hover:border-[#1665CC] hover:text-[#1665CC]'}`}>{label} <span className="opacity-70">({count})</span></button>;
const ListingTable: React.FC<{ items: Listing[]; compact?: boolean; onToggle?: (listing: Listing) => void; onDelete?: (listing: Listing) => void }> = ({ items, compact, onToggle, onDelete }) => <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-stone-200 text-[13px] font-bold uppercase tracking-[2px] text-stone-500"><tr><th className="py-3">Title</th><th>Seller</th><th>Location</th><th>Status</th>{!compact && <th>Actions</th>}</tr></thead><tbody className="divide-y divide-stone-100">{items.map((item) => <tr key={item.id}><td className="py-3 font-semibold"><Link to={`/listing/${item.id}`} className="hover:text-[#1665CC]">{item.title}</Link></td><td>{item.userName}</td><td>{item.location}</td><td><span className={`rounded-full px-2 py-1 text-xs font-bold ${item.active ? 'bg-green-50 text-green-700' : 'bg-stone-100 text-stone-600'}`}>{item.active ? 'Active' : 'Inactive'}</span></td>{!compact && <td><div className="flex items-center gap-3"><button onClick={() => onToggle?.(item)} className={`relative h-6 w-11 cursor-pointer rounded-full transition ${item.active ? 'bg-[#1665CC]' : 'bg-stone-300'}`} aria-label={item.active ? 'Deactivate listing' : 'Activate listing'}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${item.active ? 'left-6' : 'left-1'}`} /></button><button onClick={() => onDelete?.(item)} className="cursor-pointer text-red-600">Delete</button></div></td>}</tr>)}</tbody></table>{items.length === 0 && <Empty text="No items found." />}</div>;
const UserTable: React.FC<{ items: UserProfile[]; currentUserId?: string; onUpdate: (user: UserProfile, updates: Partial<UserProfile>, message: string) => void }> = ({ items, currentUserId, onUpdate }) => <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-stone-200 text-[13px] font-bold uppercase tracking-[2px] text-stone-500"><tr><th className="py-3">Name</th><th>Email</th><th>Joined</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody className="divide-y divide-stone-100">{items.map((user) => <tr key={user.uid}><td className="py-3 font-semibold">{user.displayName || 'Unnamed user'} {user.uid === currentUserId ? <span className="text-stone-400">(You)</span> : null}</td><td>{user.email}</td><td>{formatDate(user.createdAt)}</td><td><span className={`rounded-full px-2 py-1 text-xs font-bold ${user.isAdmin ? 'bg-[#1665CC]/10 text-[#1665CC]' : 'bg-stone-100 text-stone-600'}`}>{user.isAdmin ? 'Admin' : 'User'}</span></td><td><span className={`rounded-full px-2 py-1 text-xs font-bold ${user.deactivated ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{user.deactivated ? 'Banned' : 'Active'}</span></td><td><div className="flex items-center gap-2"><button disabled={user.uid === currentUserId} onClick={() => onUpdate(user, { isAdmin: !user.isAdmin }, user.isAdmin ? 'Admin role removed.' : 'Admin role added.')} className="cursor-pointer rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-700 disabled:cursor-not-allowed disabled:opacity-40">{user.isAdmin ? 'Remove Admin' : 'Make Admin'}</button><button disabled={user.uid === currentUserId} onClick={() => onUpdate(user, { deactivated: !user.deactivated }, user.deactivated ? 'User restored.' : 'User banned.')} className="cursor-pointer rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-40">{user.deactivated ? 'Restore' : 'Ban'}</button></div></td></tr>)}</tbody></table>{items.length === 0 && <Empty text="No users found." />}</div>;
const ReportList: React.FC<{ items: Report[]; onResolve?: (report: Report) => void }> = ({ items, onResolve }) => <div className="space-y-3">{items.map((report) => <div key={report.id} className="rounded-xl border border-stone-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-stone-950">{report.targetName}</p><p className="text-sm text-stone-500">{report.reason} · {report.reporterName}</p>{report.details && <p className="mt-2 text-sm text-stone-600">{report.details}</p>}</div>{!report.resolved && onResolve && <button onClick={() => onResolve(report)} className="cursor-pointer rounded-lg border border-green-200 px-3 py-2 text-sm font-semibold text-green-700">Resolve</button>}</div></div>)}{items.length === 0 && <Empty text="No reports found." />}</div>;
const PostTable: React.FC<{ items: BlogPost[] }> = ({ items }) => <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-stone-200 text-[13px] font-bold uppercase tracking-[2px] text-stone-500"><tr><th className="py-3">Title</th><th>Author</th><th>Date</th><th>Status</th></tr></thead><tbody className="divide-y divide-stone-100">{items.map((post) => <tr key={post.id}><td className="py-3 font-semibold text-stone-950">{post.title}</td><td>{post.authorName}</td><td>{formatDate(post.publishedAt || post.createdAt)}</td><td>{post.status}</td></tr>)}</tbody></table>{items.length === 0 && <Empty text="No posts yet." />}</div>;
const SimpleTaxonomy: React.FC<{ title: string; collectionName: string }> = ({ title, collectionName }) => { const [name, setName] = useState(''); const save = async () => { if (!name.trim()) return; await addDoc(collection(db, collectionName), { name: name.trim(), createdAt: Date.now() }); setName(''); }; return <Panel title={title}><div className="flex gap-3"><input value={name} onChange={(e) => setName(e.target.value)} placeholder={`Add ${title.toLowerCase().slice(0, -1)}`} className="admin-input" /><button onClick={save} className="cursor-pointer rounded-xl bg-[#1665CC] px-5 py-3 text-sm font-bold text-white">Add</button></div></Panel>; };
const EditorButton: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => <button type="button" onClick={onClick} className="cursor-pointer rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-semibold hover:bg-stone-50">{label}</button>;
const SeoInput: React.FC<{ label: string; value: string; limit: number; onChange: (value: string) => void }> = ({ label, value, limit, onChange }) => <label className="admin-label mb-4 block">{label}<span className={value.length > limit ? 'ml-2 text-red-600' : 'ml-2 text-stone-400'}>{value.length} / {limit}</span><input value={value} maxLength={limit + 20} onChange={(e) => onChange(e.target.value)} className="admin-input mt-1" /></label>;
const SeoTextArea: React.FC<{ label: string; value: string; limit: number; onChange: (value: string) => void }> = ({ label, value, limit, onChange }) => <label className="admin-label block">{label}<span className={value.length > limit ? 'ml-2 text-red-600' : 'ml-2 text-stone-400'}>{value.length} / {limit}</span><textarea value={value} maxLength={limit + 40} onChange={(e) => onChange(e.target.value)} className="admin-input mt-1 min-h-[120px]" /></label>;
const Empty: React.FC<{ text: string }> = ({ text }) => <div className="py-8 text-center text-sm text-stone-500">{text}</div>;
const AdminFooter = () => <footer className="w-full border-t border-stone-200 bg-white/80 px-4 py-5 text-[14px] text-stone-600"><div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-5 gap-y-2"><Link to="/contact" className="hover:text-stone-900">Support</Link><span className="hidden h-4 w-px bg-stone-200 sm:inline-block" /><Link to="/terms" className="hover:text-stone-900">Terms of Use</Link><span className="hidden h-4 w-px bg-stone-200 sm:inline-block" /><Link to="/privacy-policy" className="hover:text-stone-900">Privacy Policy</Link><span className="hidden h-4 w-px bg-stone-200 sm:inline-block" /><Link to="/cookies" className="hover:text-stone-900">Cookie Policy</Link><span className="hidden h-4 w-px bg-stone-200 sm:inline-block" /><span>© 2026 Reshelved.</span></div></footer>;

export default AdminUserDashboard;
