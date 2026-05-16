import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, getMetadata, ref, uploadBytes } from 'firebase/storage';
import { Link } from 'react-router-dom';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import AdminLegalPagesEditor from '../components/AdminLegalPagesEditor';
import type { Listing, Report, UserProfile } from '../types';

type AdminView = 'overview' | 'listings' | 'users' | 'reports' | 'posts' | 'newPost' | 'categories' | 'tags' | 'media' | 'settings' | 'legalPages';
type ListingStatusFilter = 'active' | 'inactive' | 'all';
type BlogStatus = 'published' | 'draft' | 'pending';
type PostFilter = 'all' | 'published' | 'draft';
type BlogPost = { id: string; title: string; content: string; authorName: string; authorId?: string; seoTitle: string; slug: string; seoDescription: string; featuredImage: string; category: string; tags: string; status: BlogStatus; createdAt: number; publishedAt?: number | null };
type MediaItem = { id: string; title: string; alt: string; url: string; source: string; size: number; contentType?: string };
type ConfirmAction = { title: string; message: string; onConfirm: () => Promise<void> | void } | null;

const formatDate = (timestamp?: number | null) => timestamp ? new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Not recorded';
const formatBytes = (bytes?: number) => !bytes ? 'Unknown size' : `${bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) : Math.round(bytes / 1024)} ${bytes >= 1024 * 1024 ? 'MB' : 'KB'}`;
const getFormat = (type?: string) => type?.split('/')[1]?.toUpperCase() || 'IMAGE';
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 75);
const firstImage = (images?: unknown) => Array.isArray(images) ? images.find((image) => typeof image === 'string' && image.trim()) : '';
const safeDays = (value: string | number) => Math.max(1, Math.min(45, Number(value) || 10));
const isOnline = (user: UserProfile) => Boolean(user.online) && Date.now() - (user.lastSeen || 0) < 2 * 60 * 1000;
const emptyPost = { title: '', seoTitle: '', slug: '', seoDescription: '', featuredImage: '', category: '', tags: '' };

const AdminUserDashboard: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<AdminView>('overview');
  const [listingStatus, setListingStatus] = useState<ListingStatusFilter>('active');
  const [postFilter, setPostFilter] = useState<PostFilter>('all');
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [search, setSearch] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openSections, setOpenSections] = useState({ blog: true, legal: true, platform: true });
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [settings, setSettings] = useState({ listingDays: '10', siteTitle: 'Reshelved', siteDescription: '', siteFavicon: '' });
  const [post, setPost] = useState(emptyPost);
  const [postContent, setPostContent] = useState('');
  const [savingPost, setSavingPost] = useState(false);
  const [uploadingFeaturedImage, setUploadingFeaturedImage] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3000); };
  const applyFavicon = (url: string) => {
    if (!url) return;
    let icon = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (!icon) { icon = document.createElement('link'); icon.rel = 'icon'; document.head.appendChild(icon); }
    icon.href = url;
  };

  const fetchMediaMetadata = async (items: MediaItem[]) => {
    const unique = Array.from(new Map(items.filter((item) => item.url).map((item) => [item.url, item])).values());
    const enriched = await Promise.all(unique.map(async (item) => {
      try {
        const meta = await getMetadata(ref(storage, item.url));
        return { ...item, title: item.title || meta.name || 'Image', size: meta.size || item.size, contentType: meta.contentType || item.contentType };
      } catch {
        return item;
      }
    }));
    setMedia(enriched);
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

      let nextSettings = settings;
      if (settingsSnap?.exists()) {
        const data = settingsSnap.data();
        nextSettings = { listingDays: String(data.listingDays || 10), siteTitle: data.siteTitle || 'Reshelved', siteDescription: data.siteDescription || '', siteFavicon: data.siteFavicon || '' };
        setSettings(nextSettings);
        applyFavicon(nextSettings.siteFavicon);
      }

      const mediaSeed: MediaItem[] = [];
      listingItems.forEach((listing) => {
        if (Array.isArray(listing.images)) listing.images.forEach((url, index) => typeof url === 'string' && mediaSeed.push({ id: `listing-${listing.id}-${index}`, title: listing.title, alt: listing.title, url, source: 'Listing', size: 0 }));
        if (listing.userPhoto) mediaSeed.push({ id: `seller-${listing.id}`, title: `${listing.userName || 'User'} profile photo`, alt: listing.userName || 'Profile photo', url: listing.userPhoto, source: 'Profile', size: 0 });
      });
      postItems.forEach((item) => item.featuredImage && mediaSeed.push({ id: `post-${item.id}`, title: item.title, alt: item.title, url: item.featuredImage, source: 'Blog featured image', size: 0 }));
      if (nextSettings.siteFavicon) mediaSeed.push({ id: 'site-favicon', title: 'Site favicon', alt: 'Site favicon', url: nextSettings.siteFavicon, source: 'Platform', size: 0 });
      fetchMediaMetadata(mediaSeed);
    } catch (error) {
      console.error('Admin dashboard failed to load:', error);
      showToast('Admin data failed to load. Check Firestore rules.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAdminData(); }, [userProfile?.isAdmin]);
  useEffect(() => { setSearch(''); setMobileMenuOpen(false); }, [view]);
  useEffect(() => {
    if (view === 'newPost' && editorRef.current && editorRef.current.innerHTML !== postContent) {
      editorRef.current.innerHTML = postContent;
    }
  }, [view]);

  const activeListings = useMemo(() => listings.filter((listing) => listing.active && listing.expiresAt > Date.now()), [listings]);
  const inactiveListings = useMemo(() => listings.filter((listing) => !listing.active || listing.expiresAt <= Date.now()), [listings]);
  const openReports = useMemo(() => reports.filter((report) => !report.resolved), [reports]);
  const onlineUsers = useMemo(() => users.filter(isOnline), [users]);
  const admins = useMemo(() => users.filter((user) => user.isAdmin), [users]);
  const publishedPosts = useMemo(() => posts.filter((item) => item.status === 'published'), [posts]);
  const draftPosts = useMemo(() => posts.filter((item) => item.status === 'draft'), [posts]);

  const listedByStatus = listingStatus === 'active' ? activeListings : listingStatus === 'inactive' ? inactiveListings : listings;
  const filteredListings = listedByStatus.filter((listing) => [listing.title, listing.author, listing.userName, listing.location, listing.category, listing.active ? 'active' : 'inactive'].join(' ').toLowerCase().includes(search.toLowerCase()));
  const filteredUsers = users.filter((user) => [user.displayName, user.email, user.location, user.isAdmin ? 'admin' : 'user'].join(' ').toLowerCase().includes(search.toLowerCase()));
  const filteredReports = reports.filter((report) => [report.targetName, report.reporterName, report.reason, report.details, report.resolved ? 'resolved' : 'open'].join(' ').toLowerCase().includes(search.toLowerCase()));
  const filteredPostBase = postFilter === 'published' ? publishedPosts : postFilter === 'draft' ? draftPosts : posts;
  const filteredPosts = filteredPostBase.filter((item) => [item.title, item.authorName, item.category, item.tags, item.status, item.content].join(' ').toLowerCase().includes(search.toLowerCase()));
  const filteredMedia = media.filter((item) => [item.title, item.source, item.contentType].join(' ').toLowerCase().includes(search.toLowerCase()));

  const runCommand = (command: string, value?: string) => { editorRef.current?.focus(); document.execCommand(command, false, value); setPostContent(editorRef.current?.innerHTML || ''); };
  const insertHtml = (html: string) => runCommand('insertHTML', html);
  const addLink = () => { const url = window.prompt('Paste the link URL'); if (url) runCommand('createLink', url); };
  const addImageToPost = () => { const imageUrl = window.prompt('Paste the image URL'); if (imageUrl) runCommand('insertImage', imageUrl); };
  const addGallery = () => { const urls = window.prompt('Paste image URLs separated by commas'); if (urls) insertHtml(`<div class="grid grid-cols-2 gap-3 my-6">${urls.split(',').map((url) => `<img src="${url.trim()}" class="rounded-xl w-full" />`).join('')}</div>`); };
  const addTable = () => insertHtml('<table class="my-6 w-full border-collapse"><tbody><tr><td class="border p-2">Column 1</td><td class="border p-2">Column 2</td></tr><tr><td class="border p-2">Text</td><td class="border p-2">Text</td></tr></tbody></table>');

  const uploadFile = async (file: File, path: string) => {
    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const fileRef = ref(storage, `${path}/${Date.now()}-${cleanName}`);
    await uploadBytes(fileRef, file, { contentType: file.type || 'image/svg+xml' });
    return getDownloadURL(fileRef);
  };

  const uploadFeaturedImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    if (!file.type.startsWith('image/')) return showToast('Please upload an image file.');
    setUploadingFeaturedImage(true);
    try { const url = await uploadFile(file, 'blog/featured'); setPost((current) => ({ ...current, featuredImage: url })); showToast('Featured image uploaded.'); }
    catch (error) { console.error(error); showToast('Featured image failed to upload. Check Storage rules.'); }
    finally { setUploadingFeaturedImage(false); }
  };

  const uploadFavicon = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
    if (!(isSvg || file.type === 'image/png')) return showToast('Upload a square SVG or PNG favicon.');
    setUploadingFavicon(true);
    try {
      if (!isSvg) {
        await new Promise<void>((resolve, reject) => {
          const image = new Image();
          image.onload = () => image.width >= 512 && image.height >= 512 && image.width === image.height ? resolve() : reject(new Error('Favicon must be square and at least 512 by 512 pixels.'));
          image.onerror = () => reject(new Error('Could not read favicon image.'));
          image.src = URL.createObjectURL(file);
        });
      }
      const url = await uploadFile(file, 'platform/favicon');
      setSettings((current) => ({ ...current, siteFavicon: url }));
      applyFavicon(url);
      setMedia((current) => [{ id: `favicon-${Date.now()}`, title: file.name, alt: 'Site favicon', url, source: 'Platform', size: file.size, contentType: file.type }, ...current]);
      showToast('Favicon uploaded. Save settings to keep it.');
    } catch (error: any) { showToast(error?.message || 'Favicon failed to upload.'); }
    finally { setUploadingFavicon(false); }
  };

  const resetPostForm = () => {
    setEditingPostId(null);
    setPost(emptyPost);
    setPostContent('');
    if (editorRef.current) editorRef.current.innerHTML = '';
  };

  const startNewPost = () => {
    resetPostForm();
    setView('newPost');
  };

  const openPostForEdit = (item: BlogPost) => {
    setEditingPostId(item.id);
    setPost({
      title: item.title || '',
      seoTitle: item.seoTitle || item.title || '',
      slug: item.slug || slugify(item.title || ''),
      seoDescription: item.seoDescription || '',
      featuredImage: item.featuredImage || '',
      category: item.category || '',
      tags: item.tags || ''
    });
    setPostContent(item.content || '');
    setView('newPost');
  };

  const savePost = async (status: BlogStatus) => {
    setSavingPost(true);
    try {
      const title = post.title.trim(); if (!title) throw new Error('Add a post title first.');
      const content = postContent || editorRef.current?.innerHTML || '';
      const payload = {
        title,
        content,
        authorId: currentUser?.uid || '',
        authorName: userProfile?.displayName || currentUser?.displayName || 'Admin',
        seoTitle: post.seoTitle.trim() || title,
        slug: slugify(post.slug || title),
        seoDescription: post.seoDescription.trim(),
        featuredImage: post.featuredImage.trim(),
        category: post.category.trim(),
        tags: post.tags.trim(),
        status,
        updatedAt: Date.now(),
        publishedAt: status === 'published' ? Date.now() : null
      };

      if (editingPostId) {
        await updateDoc(doc(db, 'blogPosts', editingPostId), payload);
      } else {
        await addDoc(collection(db, 'blogPosts'), { ...payload, createdAt: Date.now() });
      }

      resetPostForm();
      showToast(status === 'published' ? 'Post published.' : status === 'pending' ? 'Post marked pending.' : 'Draft saved.');
      setView('posts');
      fetchAdminData();
    } catch (error: any) { showToast(error?.message || 'Post could not be saved.'); }
    finally { setSavingPost(false); }
  };

  const updatePostStatus = async (item: BlogPost, status: BlogStatus) => {
    try {
      const updates = { status, updatedAt: Date.now(), publishedAt: status === 'published' ? Date.now() : null };
      await updateDoc(doc(db, 'blogPosts', item.id), updates);
      setPosts((current) => current.map((postItem) => postItem.id === item.id ? { ...postItem, ...updates } : postItem));
      showToast('Post status updated.');
    } catch (error) {
      console.error(error);
      showToast('Post status could not be updated.');
    }
  };

  const saveSettings = async () => {
    const listingDays = safeDays(settings.listingDays);
    await setDoc(doc(db, 'platform', 'settings'), { listingDays, siteTitle: settings.siteTitle, siteDescription: settings.siteDescription, siteFavicon: settings.siteFavicon, updatedAt: Date.now() }, { merge: true });
    setSettings((current) => ({ ...current, listingDays: String(listingDays) }));
    applyFavicon(settings.siteFavicon);
    showToast('Platform settings saved.');
  };

  const askDelete = (message: string, onConfirm: () => Promise<void> | void) => setConfirmAction({ title: 'Delete confirmation', message, onConfirm });
  const toggleListing = async (listing: Listing) => { const nextActive = !listing.active; await updateDoc(doc(db, 'listings', listing.id), { active: nextActive }); setListings((current) => current.map((item) => item.id === listing.id ? { ...item, active: nextActive } : item)); showToast(nextActive ? 'Listing activated.' : 'Listing deactivated.'); };
  const deleteListing = async (listing: Listing) => askDelete('Are you sure you want to delete this?', async () => { await deleteDoc(doc(db, 'listings', listing.id)); setListings((current) => current.filter((item) => item.id !== listing.id)); showToast('Listing deleted.'); });
  const deleteMedia = async (item: MediaItem) => askDelete('Are you sure you want to delete this?', async () => { await deleteObject(ref(storage, item.url)); setMedia((current) => current.filter((mediaItem) => mediaItem.id !== item.id)); showToast('Image deleted.'); });
  const resolveReport = async (report: Report) => { await updateDoc(doc(db, 'reports', report.id), { resolved: true }); setReports((current) => current.map((item) => item.id === report.id ? { ...item, resolved: true } : item)); showToast('Report resolved.'); };
  const updateUser = async (user: UserProfile, updates: Partial<UserProfile>, message: string) => { await setDoc(doc(db, 'users', user.uid), updates, { merge: true }); setUsers((current) => current.map((item) => item.uid === user.uid ? { ...item, ...updates } : item)); showToast(message); };
  const toggleSection = (section: keyof typeof openSections) => setOpenSections((current) => ({ ...current, [section]: !current[section] }));

  const AdminNav = () => (
    <>
      <SideItem icon="la-home" label="Overview" active={view === 'overview'} onClick={() => setView('overview')} />
      <SideItem icon="la-book" label="Active listings" count={activeListings.length} active={view === 'listings'} onClick={() => setView('listings')} />
      <SideItem icon="la-users" label="Users" count={users.length} active={view === 'users'} onClick={() => setView('users')} />
      <SideItem icon="la-flag" label="Reports" count={openReports.length} active={view === 'reports'} onClick={() => setView('reports')} />
      <SideItem icon="la-photo-video" label="Media" count={media.length} active={view === 'media'} onClick={() => setView('media')} />
      <SectionToggle label="Blog" open={openSections.blog} onClick={() => toggleSection('blog')} />
      {openSections.blog && <div className="pl-2"><SideItem icon="la-newspaper" label="All Posts" count={posts.length} active={view === 'posts'} onClick={() => setView('posts')} /><SideItem icon="la-plus-circle" label="Add New" active={view === 'newPost'} onClick={startNewPost} /><SideItem icon="la-folder" label="Categories" active={view === 'categories'} onClick={() => setView('categories')} /><SideItem icon="la-tags" label="Tags" active={view === 'tags'} onClick={() => setView('tags')} /></div>}
      <SectionToggle label="Legal" open={openSections.legal} onClick={() => toggleSection('legal')} />
      {openSections.legal && <div className="pl-2"><SideItem icon="la-file-contract" label="Legal Pages" active={view === 'legalPages'} onClick={() => setView('legalPages')} /></div>}
      <SectionToggle label="Platform" open={openSections.platform} onClick={() => toggleSection('platform')} />
      {openSections.platform && <div className="pl-2"><SideItem icon="la-cog" label="Settings" active={view === 'settings'} onClick={() => setView('settings')} /></div>}
    </>
  );

  if (!userProfile?.isAdmin) return <div className="max-w-4xl mx-auto px-4 py-16 text-center"><h2 className="text-xl font-bold text-stone-800">Access Denied</h2><p className="text-stone-500 mt-2">You do not have admin privileges.</p></div>;

  return (
    <div className="h-auto min-h-screen bg-stone-50 lg:h-screen lg:overflow-hidden">
      {toast && <div className="fixed top-6 right-6 z-50 rounded-xl bg-stone-950 px-5 py-3 text-sm font-semibold text-white shadow-xl">{toast}</div>}
      {confirmAction && <ConfirmDialog action={confirmAction} onClose={() => setConfirmAction(null)} />}
      <AdminHeader title={editingPostId && view === 'newPost' ? 'Edit Post' : getViewTitle(view)} onMenu={() => setMobileMenuOpen(true)} onRefresh={fetchAdminData} />
      <div className="grid w-full grid-cols-1 lg:h-[calc(100vh-73px)] lg:grid-cols-[270px_1fr]">
        <aside className="hidden border-r border-stone-200 bg-white p-3 lg:block lg:h-full lg:overflow-y-auto"><AdminNav /></aside>
        {mobileMenuOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileMenuOpen(false)}><aside className="h-full w-[82vw] max-w-[320px] overflow-y-auto bg-white p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="mb-3 flex items-center justify-between px-2 py-2"><span className="font-bold text-stone-950">Admin menu</span><button onClick={() => setMobileMenuOpen(false)} className="cursor-pointer rounded-lg p-2 text-stone-500 hover:bg-stone-100"><i className="las la-times text-2xl" /></button></div><Link to="/" className="mb-3 flex w-full items-center justify-center rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50">Visit website</Link><AdminNav /></aside></div>}
        <main className="min-w-0 lg:h-full lg:overflow-y-auto"><div className="flex min-h-full flex-col p-4 lg:p-6"><button onClick={fetchAdminData} className="mb-4 flex w-full cursor-pointer items-center justify-center rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 lg:hidden"><i className="las la-redo-alt mr-1" />Refresh dashboard</button><div className="flex-1">{loading ? <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-stone-500">Loading dashboard...</div> : renderContent()}</div><AdminFooter /></div></main>
      </div>
    </div>
  );

  function renderContent() {
    if (view === 'overview') return <><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"><Stat label="Active listings" value={activeListings.length} icon="la-book" tone="bg-blue-50 text-[#1665CC] border-blue-100" /><Stat label="Users" value={users.length} icon="la-users" tone="bg-emerald-50 text-emerald-700 border-emerald-100" /><Stat label="Open reports" value={openReports.length} icon="la-flag" tone="bg-red-50 text-red-700 border-red-100" /><Stat label="Online users" value={onlineUsers.length} icon="la-wifi" tone="bg-amber-50 text-amber-700 border-amber-100" /></div><div className="mt-6 space-y-6"><Panel title="Recent listings"><ListingTable items={activeListings.slice(0, 8)} compact /></Panel><Panel title="Recent reports"><ReportList items={openReports.slice(0, 8)} /></Panel></div></>;
    if (view === 'listings') return <Panel title="Listings"><div className="mb-4 flex flex-wrap items-center gap-2"><StatusFilter label="Active" count={activeListings.length} active={listingStatus === 'active'} onClick={() => setListingStatus('active')} /><StatusFilter label="Inactive" count={inactiveListings.length} active={listingStatus === 'inactive'} onClick={() => setListingStatus('inactive')} /><StatusFilter label="All" count={listings.length} active={listingStatus === 'all'} onClick={() => setListingStatus('all')} /></div><SearchBar value={search} setValue={setSearch} placeholder="Search listings..." /><ListingTable items={filteredListings} onToggle={toggleListing} onDelete={deleteListing} /></Panel>;
    if (view === 'users') return <Panel title="Users"><div className="mb-3 flex flex-wrap gap-2 text-sm"><span className="font-semibold text-stone-700">All <span className="text-stone-400">({users.length})</span></span><span className="text-stone-300">|</span><span className="font-semibold text-[#1665CC]">Admins <span className="text-stone-400">({admins.length})</span></span></div><SearchBar value={search} setValue={setSearch} placeholder="Search users..." /><UserTable items={filteredUsers} currentUserId={currentUser?.uid} onUpdate={updateUser} /></Panel>;
    if (view === 'reports') return <Panel title="Reports"><SearchBar value={search} setValue={setSearch} placeholder="Search reports..." /><ReportList items={filteredReports} onResolve={resolveReport} /></Panel>;
    if (view === 'media') return <Panel title="Media Library"><SearchBar value={search} setValue={setSearch} placeholder="Search media..." /><MediaGrid items={filteredMedia} onDelete={deleteMedia} /></Panel>;
    if (view === 'posts') return <Panel title={`All Posts (${posts.length})`}><div className="mb-3 flex flex-wrap gap-2"><StatusFilter label="All" count={posts.length} active={postFilter === 'all'} onClick={() => setPostFilter('all')} /><StatusFilter label="Published" count={publishedPosts.length} active={postFilter === 'published'} onClick={() => setPostFilter('published')} /><StatusFilter label="Drafts" count={draftPosts.length} active={postFilter === 'draft'} onClick={() => setPostFilter('draft')} /></div><SearchBar value={search} setValue={setSearch} placeholder="Search posts..." /><PostTable items={filteredPosts} onEdit={openPostForEdit} onStatusChange={updatePostStatus} /></Panel>;
    if (view === 'newPost') return PostEditor();
    if (view === 'categories') return <SimpleTaxonomy title="Categories" collectionName="blogCategories" />;
    if (view === 'tags') return <SimpleTaxonomy title="Tags" collectionName="blogTags" />;
    if (view === 'settings') return <SettingsPanel />;
    if (view === 'legalPages') return <AdminLegalPagesEditor />;
    return null;
  }

  function PostEditor() {
    return <div className="grid h-auto grid-cols-1 gap-6 xl:h-[calc(100vh-132px)] xl:grid-cols-[minmax(0,1fr)_300px]"><section className="min-h-0 overflow-y-auto rounded-2xl border border-stone-200 bg-white"><div className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 px-5 py-4 backdrop-blur"><input value={post.title} onChange={(e) => setPost((current) => ({ ...current, title: e.target.value, seoTitle: current.seoTitle || e.target.value, slug: current.slug || slugify(e.target.value) }))} placeholder="Title" className="w-full border-0 border-b border-stone-200 px-0 py-4 text-4xl font-bold outline-none focus:border-[#1665CC]" /><div className="mt-4 flex flex-wrap gap-2"><EditorButton label="B" onClick={() => runCommand('bold')} /><EditorButton label="I" onClick={() => runCommand('italic')} /><EditorButton label="H2" onClick={() => runCommand('formatBlock', 'h2')} /><EditorButton label="H3" onClick={() => runCommand('formatBlock', 'h3')} /><EditorButton label="H4" onClick={() => runCommand('formatBlock', 'h4')} /><EditorButton label="✦" onClick={() => runCommand('backColor', '#fff3b0')} title="Highlight" /><EditorButton label="•" onClick={() => runCommand('insertUnorderedList')} title="List" /><EditorButton icon="las la-link" onClick={addLink} title="Link" /><EditorButton icon="las la-border-all" onClick={addTable} title="Table" /><EditorButton icon="las la-images" onClick={addGallery} title="Gallery" /><EditorButton icon="las la-image" onClick={addImageToPost} title="Image" /></div></div><div ref={editorRef} contentEditable suppressContentEditableWarning onInput={(event) => setPostContent(event.currentTarget.innerHTML)} onBlur={(event) => setPostContent(event.currentTarget.innerHTML)} className="min-h-[760px] px-6 py-7 text-lg leading-8 text-stone-800 outline-none empty:before:text-stone-400 empty:before:content-['Start_writing_your_post...'] [&_p]:mb-4 [&_h2]:mt-8 [&_h2]:text-3xl [&_h2]:font-bold [&_h3]:mt-7 [&_h3]:text-2xl [&_h3]:font-bold [&_h4]:mt-6 [&_h4]:text-xl [&_h4]:font-bold [&_img]:my-6 [&_img]:rounded-2xl [&_table]:my-6 [&_td]:border [&_td]:border-stone-200 [&_td]:p-2" /></section><aside className="min-h-0 space-y-4 overflow-y-auto pr-1"><Panel title={editingPostId ? 'Update' : 'Publish'}><button disabled={savingPost} onClick={() => savePost('published')} className="w-full cursor-pointer rounded-full bg-primary-600 px-5 py-3 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50">{editingPostId ? 'Update & Publish' : 'Publish'}</button><button disabled={savingPost} onClick={() => savePost('draft')} className="mt-2 w-full cursor-pointer rounded-full border border-stone-200 px-5 py-3 text-sm font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-50">Save draft</button><button disabled={savingPost} onClick={() => savePost('pending')} className="mt-2 w-full cursor-pointer rounded-full border border-amber-200 px-5 py-3 text-sm font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-50">Mark pending</button></Panel><Panel title="Featured image"><label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-center text-sm font-semibold text-stone-600 hover:border-[#1665CC] hover:bg-[#1665CC]/5"><input type="file" accept="image/*" onChange={uploadFeaturedImage} className="hidden" />{uploadingFeaturedImage ? 'Uploading...' : 'Upload featured image'}</label>{post.featuredImage && <img src={post.featuredImage} alt="Featured preview" className="mt-3 aspect-video w-full rounded-xl object-cover" />}</Panel><Panel title="SEO Settings"><SeoInput label="SEO title" value={post.seoTitle} limit={60} onChange={(value) => setPost((current) => ({ ...current, seoTitle: value }))} /><SeoInput label="URL slug" value={post.slug} limit={75} onChange={(value) => setPost((current) => ({ ...current, slug: slugify(value) }))} /><SeoTextArea label="SEO meta description" value={post.seoDescription} limit={160} onChange={(value) => setPost((current) => ({ ...current, seoDescription: value }))} /></Panel><Panel title="Organization"><input value={post.category} onChange={(e) => setPost((current) => ({ ...current, category: e.target.value }))} placeholder="Category" className="admin-input" /><input value={post.tags} onChange={(e) => setPost((current) => ({ ...current, tags: e.target.value }))} placeholder="Tags, comma separated" className="admin-input mt-3" /></Panel></aside></div>;
  }

  function SettingsPanel() { return <Panel title="Platform settings"><div className="grid max-w-2xl gap-5" onKeyDown={(event) => event.stopPropagation()}><label className="admin-label">Active listing duration<div className="mt-2 grid grid-cols-[1fr_120px] items-center gap-3"><input type="range" min="1" max="45" value={safeDays(settings.listingDays)} onChange={(event) => setSettings((current) => ({ ...current, listingDays: event.target.value }))} className="accent-[#1665CC]" /><div className="relative"><input type="number" min="1" max="45" value={settings.listingDays} onChange={(event) => setSettings((current) => ({ ...current, listingDays: String(safeDays(event.target.value)) }))} className="admin-input pr-12" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-500">days</span></div></div></label><label className="admin-label">Site title<input type="text" value={settings.siteTitle} onKeyDown={(event) => event.stopPropagation()} onChange={(event) => setSettings((current) => ({ ...current, siteTitle: event.target.value }))} className="admin-input mt-1" /></label><label className="admin-label">Site description<input type="text" value={settings.siteDescription} onKeyDown={(event) => event.stopPropagation()} onChange={(event) => setSettings((current) => ({ ...current, siteDescription: event.target.value }))} className="admin-input mt-1" /></label><label className="admin-label">Site favicon <span className="font-normal normal-case tracking-normal text-stone-500">Square SVG or PNG and at least 512 by 512 pixels.</span><label className="mt-2 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-center text-sm font-semibold text-stone-600 hover:border-[#1665CC] hover:bg-[#1665CC]/5"><input type="file" accept="image/svg+xml,image/png" onChange={uploadFavicon} className="hidden" />{uploadingFavicon ? 'Uploading...' : 'Upload favicon'}</label>{settings.siteFavicon && <div className="mt-3 flex items-center gap-3"><img src={settings.siteFavicon} alt="Site favicon" className="h-16 w-16 rounded-xl border border-stone-200 object-contain p-2" /><span className="text-sm font-normal normal-case tracking-normal text-stone-500">Current favicon</span></div>}</label><button onClick={saveSettings} className="w-fit cursor-pointer rounded-xl bg-[#1665CC] px-5 py-3 text-sm font-bold text-white">Save settings</button></div></Panel>; }
};

const getViewTitle = (view: AdminView) => ({ overview: 'Overview', listings: 'Listings', users: 'Users', reports: 'Reports', posts: 'All Posts', newPost: 'Add New Post', categories: 'Categories', tags: 'Tags', media: 'Media Library', settings: 'Platform settings', legalPages: 'Legal Pages' }[view]);
const AdminHeader: React.FC<{ title: string; onMenu: () => void; onRefresh: () => void }> = ({ title, onMenu, onRefresh }) => <header className="sticky top-0 z-30 w-full border-b border-stone-200 bg-white"><div className="flex min-h-[73px] w-full items-center justify-between px-4 lg:px-6"><div className="flex min-w-0 items-center gap-3"><button onClick={onMenu} className="cursor-pointer rounded-xl border border-stone-200 px-3 py-2 text-sm font-semibold text-stone-700 lg:hidden"><i className="las la-bars text-lg" /></button><Link to="/" className="mr-0 flex shrink-0 items-center gap-3 lg:mr-5"><img src="/reshelved-logo.svg" alt="Reshelved" className="h-8 max-h-[70px] w-auto lg:h-auto" onError={(event) => { event.currentTarget.style.display = 'none'; }} /><span className="hidden text-sm font-bold text-stone-500 sm:inline">Admin</span></Link><span className="hidden h-6 w-px bg-stone-200 sm:block" /><h1 className="truncate text-lg font-bold text-stone-950 sm:text-xl">{title}</h1></div><div className="hidden items-center gap-2 lg:flex"><Link to="/" className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50">View site</Link><button onClick={onRefresh} className="cursor-pointer rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"><i className="las la-redo-alt mr-1" />Refresh</button></div></div></header>;
const SectionToggle: React.FC<{ label: string; open: boolean; onClick: () => void }> = ({ label, open, onClick }) => <button type="button" onClick={onClick} className="mt-4 flex w-full cursor-pointer items-center justify-between px-3 text-[13px] font-bold uppercase tracking-[2px] text-[#1665CC]"><span>{label}</span><i className={`las ${open ? 'la-angle-down' : 'la-angle-right'} text-base`} /></button>;
const SideItem: React.FC<{ icon: string; label: string; active: boolean; onClick: () => void; count?: number }> = ({ icon, label, active, onClick, count }) => <button onClick={onClick} className={`mt-1 flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${active ? 'bg-stone-100 text-stone-950' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-950'}`}><span><i className={`las ${icon} mr-2 text-lg text-stone-400`} />{label}</span>{count !== undefined && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">{count}</span>}</button>;
const Stat: React.FC<{ label: string; value: number; icon: string; tone: string }> = ({ label, value, icon, tone }) => <div className={`rounded-2xl border bg-white p-5 ${tone}`}><i className={`las ${icon} text-2xl`} /><p className="mt-4 text-3xl font-bold text-stone-950">{value}</p><p className="text-[13px] font-bold uppercase tracking-[2px] text-stone-500">{label}</p></div>;
const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => <section className="rounded-2xl border border-stone-200 bg-white p-5"><h3 className="mb-4 text-[15px] font-bold text-stone-950">{title}</h3>{children}</section>;
const SearchBar: React.FC<{ value: string; setValue: (value: string) => void; placeholder: string }> = ({ value, setValue, placeholder }) => <input value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} className="mb-4 w-full rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10" />;
const StatusFilter: React.FC<{ label: string; count: number; active: boolean; onClick: () => void }> = ({ label, count, active, onClick }) => <button onClick={onClick} className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-bold transition ${active ? 'border-[#1665CC] bg-[#1665CC]/10 text-[#1665CC]' : 'border-stone-200 text-stone-600 hover:border-[#1665CC] hover:text-[#1665CC]'}`}>{label} <span className="opacity-70">({count})</span></button>;
const ListingTable: React.FC<{ items: Listing[]; compact?: boolean; onToggle?: (listing: Listing) => void; onDelete?: (listing: Listing) => void }> = ({ items, compact, onToggle, onDelete }) => <div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-left text-sm"><thead className="border-b border-stone-200 text-[13px] font-bold uppercase tracking-[2px] text-stone-500"><tr><th className="py-3">Title</th><th>Author</th><th>Category</th><th>Cover</th><th>Seller</th><th>Location</th><th>Date</th><th>Status</th>{!compact && <th>Actions</th>}</tr></thead><tbody className="divide-y divide-stone-100">{items.map((item) => <tr key={item.id}><td className="py-3 font-semibold"><Link to={`/listing/${item.id}`} className="hover:text-[#1665CC]">{item.title}</Link></td><td>{item.author}</td><td>{item.category}</td><td>{firstImage(item.images) ? <img src={firstImage(item.images)} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="text-stone-300">No image</span>}</td><td>{item.userName}</td><td>{item.location}</td><td>{formatDate(item.createdAt)}</td><td><span className={`rounded-full px-2 py-1 text-xs font-bold ${item.active ? 'bg-green-50 text-green-700' : 'bg-stone-100 text-stone-600'}`}>{item.active ? 'Active' : 'Inactive'}</span></td>{!compact && <td><div className="flex items-center gap-3"><button onClick={() => onToggle?.(item)} className={`relative h-6 w-11 cursor-pointer rounded-full transition ${item.active ? 'bg-[#1665CC]' : 'bg-stone-300'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${item.active ? 'left-6' : 'left-1'}`} /></button><button onClick={() => onDelete?.(item)} className="cursor-pointer text-red-600">Delete</button></div></td>}</tr>)}</tbody></table>{items.length === 0 && <Empty text="No items found." />}</div>;
const UserTable: React.FC<{ items: UserProfile[]; currentUserId?: string; onUpdate: (user: UserProfile, updates: Partial<UserProfile>, message: string) => void }> = ({ items, currentUserId, onUpdate }) => <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-stone-200 text-[13px] font-bold uppercase tracking-[2px] text-stone-500"><tr><th className="py-3">Name</th><th>Email</th><th>Joined</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody className="divide-y divide-stone-100">{items.map((user) => <tr key={user.uid}><td className="py-3 font-semibold">{user.displayName || 'Unnamed user'} {user.uid === currentUserId ? <span className="text-stone-400">(You)</span> : null}</td><td>{user.email}</td><td>{formatDate(user.createdAt)}</td><td><span className={`rounded-full px-2 py-1 text-xs font-bold ${user.isAdmin ? 'bg-[#1665CC]/10 text-[#1665CC]' : 'bg-stone-100 text-stone-600'}`}>{user.isAdmin ? 'Admin' : 'User'}</span></td><td><span className={`rounded-full px-2 py-1 text-xs font-bold ${user.deactivated ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{user.deactivated ? 'Banned' : 'Active'}</span></td><td><div className="flex items-center gap-2"><button disabled={user.uid === currentUserId} onClick={() => onUpdate(user, { isAdmin: !user.isAdmin }, user.isAdmin ? 'Admin role removed.' : 'Admin role added.')} className="cursor-pointer rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-700 disabled:cursor-not-allowed disabled:opacity-40">{user.isAdmin ? 'Remove Admin' : 'Make Admin'}</button><button disabled={user.uid === currentUserId} onClick={() => onUpdate(user, { deactivated: !user.deactivated }, user.deactivated ? 'User restored.' : 'User banned.')} className="cursor-pointer rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-40">{user.deactivated ? 'Restore' : 'Ban'}</button></div></td></tr>)}</tbody></table>{items.length === 0 && <Empty text="No users found." />}</div>;
const ReportList: React.FC<{ items: Report[]; onResolve?: (report: Report) => void }> = ({ items, onResolve }) => <div className="space-y-3">{items.map((report) => <div key={report.id} className="rounded-xl border border-stone-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-stone-950">{report.targetName}</p><p className="text-sm text-stone-500">{report.reason} · {report.reporterName}</p>{report.details && <p className="mt-2 text-sm text-stone-600">{report.details}</p>}</div>{!report.resolved && onResolve && <button onClick={() => onResolve(report)} className="cursor-pointer rounded-lg border border-green-200 px-3 py-2 text-sm font-semibold text-green-700">Resolve</button>}</div></div>)}{items.length === 0 && <Empty text="No reports found." />}</div>;
const MediaGrid: React.FC<{ items: MediaItem[]; onDelete: (item: MediaItem) => void }> = ({ items, onDelete }) => <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{items.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white"><div className="aspect-square bg-stone-100"><img src={item.url} alt={item.alt} className="h-full w-full object-cover" /></div><div className="space-y-1 p-4 text-sm"><p className="truncate font-bold text-stone-950">{item.title}</p><p className="text-stone-500">{item.source} · {formatBytes(item.size)} · {getFormat(item.contentType)}</p><button onClick={() => onDelete(item)} className="mt-2 cursor-pointer text-sm font-semibold text-red-600 hover:text-red-700">Delete</button></div></article>)}{items.length === 0 && <div className="col-span-full"><Empty text="No images found." /></div>}</div>;
const PostTable: React.FC<{ items: BlogPost[]; onEdit: (post: BlogPost) => void; onStatusChange: (post: BlogPost, status: BlogStatus) => void }> = ({ items, onEdit, onStatusChange }) => <div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-sm"><thead className="border-b border-stone-200 text-[13px] font-bold uppercase tracking-[2px] text-stone-500"><tr><th className="py-3">Title</th><th>Category</th><th>Tags</th><th>Author</th><th>Date</th><th>Status</th></tr></thead><tbody className="divide-y divide-stone-100">{items.map((item) => <tr key={item.id} onClick={() => onEdit(item)} className="cursor-pointer hover:bg-stone-50"><td className="max-w-[320px] py-3 font-semibold text-stone-950"><span className="line-clamp-1 hover:text-[#1665CC]">{item.title || 'Untitled post'}</span></td><td>{item.category || 'Uncategorized'}</td><td className="max-w-[240px]"><span className="line-clamp-1 text-stone-600">{item.tags || 'No tags'}</span></td><td>{item.authorName || 'Admin'}</td><td>{formatDate(item.publishedAt || item.createdAt)}</td><td><select value={item.status || 'draft'} onClick={(event) => event.stopPropagation()} onChange={(event) => onStatusChange(item, event.target.value as BlogStatus)} className={`rounded-full border px-3 py-1 text-xs font-bold outline-none ${item.status === 'published' ? 'border-green-200 bg-green-50 text-green-700' : item.status === 'pending' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}><option value="draft">Draft</option><option value="pending">Pending</option><option value="published">Published</option></select></td></tr>)}</tbody></table>{items.length === 0 && <Empty text="No posts yet." />}</div>;
const SimpleTaxonomy: React.FC<{ title: string; collectionName: string }> = ({ title, collectionName }) => { const [name, setName] = useState(''); const save = async () => { if (!name.trim()) return; await addDoc(collection(db, collectionName), { name: name.trim(), createdAt: Date.now() }); setName(''); }; return <Panel title={title}><div className="flex gap-3"><input value={name} onChange={(event) => setName(event.target.value)} placeholder={`Add ${title.toLowerCase()}`} className="admin-input" /><button onClick={save} className="cursor-pointer rounded-xl bg-[#1665CC] px-5 py-3 text-sm font-bold text-white">Add</button></div></Panel>; };
const EditorButton: React.FC<{ label?: string; icon?: string; onClick: () => void; title?: string }> = ({ label, icon, onClick, title }) => <button type="button" title={title || label} onClick={onClick} className="cursor-pointer rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-semibold hover:bg-stone-50">{icon ? <i className={`${icon} text-lg`} /> : label}</button>;
const SeoInput: React.FC<{ label: string; value: string; limit: number; onChange: (value: string) => void }> = ({ label, value, limit, onChange }) => <label className="admin-label mb-4 block">{label}<span className={value.length > limit ? 'ml-2 text-red-600' : 'ml-2 text-stone-400'}>{value.length} / {limit}</span><input value={value} maxLength={limit + 20} onKeyDown={(event) => event.stopPropagation()} onChange={(event) => onChange(event.target.value)} className="admin-input mt-1" /></label>;
const SeoTextArea: React.FC<{ label: string; value: string; limit: number; onChange: (value: string) => void }> = ({ label, value, limit, onChange }) => <label className="admin-label block">{label}<span className={value.length > limit ? 'ml-2 text-red-600' : 'ml-2 text-stone-400'}>{value.length} / {limit}</span><textarea value={value} maxLength={limit + 40} onKeyDown={(event) => event.stopPropagation()} onChange={(event) => onChange(event.target.value)} className="admin-input mt-1 min-h-[120px]" /></label>;
const Empty: React.FC<{ text: string }> = ({ text }) => <div className="py-8 text-center text-sm text-stone-500">{text}</div>;
const ConfirmDialog: React.FC<{ action: Exclude<ConfirmAction, null>; onClose: () => void }> = ({ action, onClose }) => <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-lg font-bold text-stone-950">{action.title}</h2><p className="mt-2 text-sm text-stone-600">{action.message}</p><div className="mt-5 grid grid-cols-2 gap-3"><button onClick={onClose} className="cursor-pointer rounded-xl border border-stone-200 px-4 py-2 text-sm font-bold text-stone-700 hover:bg-stone-50">Cancel</button><button onClick={async () => { await action.onConfirm(); onClose(); }} className="cursor-pointer rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700">Delete</button></div></div></div>;
const AdminFooter = () => <footer className="mt-8 border-t border-stone-200 bg-white/80 px-4 py-5 text-[14px] text-stone-600"><div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-5 gap-y-2"><Link to="/contact" className="hover:text-stone-900">Support</Link><span className="hidden h-4 w-px bg-stone-200 sm:inline-block" /><Link to="/terms" className="hover:text-stone-900">Terms of Use</Link><span className="hidden h-4 w-px bg-stone-200 sm:inline-block" /><Link to="/privacy-policy" className="hover:text-stone-900">Privacy Policy</Link><span className="hidden h-4 w-px bg-stone-200 sm:inline-block" /><Link to="/cookies" className="hover:text-stone-900">Cookie Policy</Link><span className="hidden h-4 w-px bg-stone-200 sm:inline-block" /><span>© 2026 Reshelved.</span></div></footer>;

export default AdminUserDashboard;
