import React, { useCallback, useEffect, useRef, useState } from 'react';
import { addDoc, collection, getDocs } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import AdminUserDashboard from './AdminUserDashboard';
import type { UserProfile } from '../types';
import './AdminUserDashboardStyled.css';

type LibraryImage = {
  id: string;
  url: string;
  filename?: string;
  altText?: string;
  uploadedAt?: number;
};

type NotificationTarget = 'all' | 'specific';
type NotificationStep = 'form' | 'confirm';

const AdminUserDashboardStyled: React.FC = () => {
  const { userProfile, logout } = useAuth() as any;
  const [sending, setSending] = useState(false);
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [notificationStep, setNotificationStep] = useState<NotificationStep>('form');
  const [notificationTarget, setNotificationTarget] = useState<NotificationTarget>('all');
  const [notificationSubject, setNotificationSubject] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationUsers, setNotificationUsers] = useState<UserProfile[]>([]);
  const [notificationUserSearch, setNotificationUserSearch] = useState('');
  const [selectedNotificationUserId, setSelectedNotificationUserId] = useState('');
  const [loadingNotificationUsers, setLoadingNotificationUsers] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageModalTab, setImageModalTab] = useState<'upload' | 'library'>('upload');
  const [imageUploading, setImageUploading] = useState(false);
  const [libraryImages, setLibraryImages] = useState<LibraryImage[]>([]);
  const [imageAltText, setImageAltText] = useState('');
  const savedEditorRangeRef = useRef<Range | null>(null);

  const loadNotificationUsers = useCallback(async () => {
    setLoadingNotificationUsers(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const users: UserProfile[] = [];
      usersSnap.forEach((item) => users.push({ uid: item.id, ...item.data() } as UserProfile));
      users.sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''));
      setNotificationUsers(users);
    } catch (error) {
      console.error(error);
      window.alert('Could not load registered users. Check Firestore rules.');
    } finally {
      setLoadingNotificationUsers(false);
    }
  }, []);

  const openSendUpdateModal = useCallback(() => {
    if (!userProfile?.isAdmin || sending) return;
    setNotificationStep('form');
    setNotificationTarget('all');
    setNotificationUserSearch('');
    setSelectedNotificationUserId('');
    setNotificationModalOpen(true);
    loadNotificationUsers();
  }, [loadNotificationUsers, sending, userProfile?.isAdmin]);

  const selectedNotificationUser = notificationUsers.find((item) => item.uid === selectedNotificationUserId);
  const notificationRecipients = notificationTarget === 'all'
    ? notificationUsers
    : selectedNotificationUser
      ? [selectedNotificationUser]
      : [];
  const notificationRecipientCount = notificationRecipients.length;
  const canReviewNotification = notificationSubject.trim().length > 0 && notificationMessage.trim().length > 0 && notificationRecipientCount > 0;
  const filteredNotificationUsers = notificationUsers.filter((item) => {
    const query = notificationUserSearch.trim().toLowerCase();
    if (!query) return true;
    return [item.displayName, item.email, item.uid].join(' ').toLowerCase().includes(query);
  }).slice(0, 8);

  const sendReviewedNotification = useCallback(async () => {
    if (!userProfile?.isAdmin || sending || !canReviewNotification) return;
    setSending(true);
    try {
      const subject = notificationSubject.trim();
      const message = notificationMessage.trim();
      await Promise.all(notificationRecipients.map((user) => addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        userName: user.displayName || user.email || 'User',
        fromAdmin: true,
        subject,
        message,
        createdAt: Date.now(),
        read: false,
      })));

      window.alert(`Update sent to ${notificationRecipientCount} ${notificationRecipientCount === 1 ? 'user' : 'users'}.`);
      setNotificationModalOpen(false);
      setNotificationStep('form');
      setNotificationSubject('');
      setNotificationMessage('');
      setNotificationUserSearch('');
      setSelectedNotificationUserId('');
      setNotificationTarget('all');
    } catch (error) {
      console.error(error);
      window.alert('Update could not be sent. Check Firestore rules.');
    } finally {
      setSending(false);
    }
  }, [canReviewNotification, notificationMessage, notificationRecipientCount, notificationRecipients, notificationSubject, sending, userProfile?.isAdmin]);

  const getEditor = useCallback(() => document.querySelector<HTMLElement>('.admin-tiktok-shell [contenteditable="true"]'), []);

  const selectionIsInsideEditor = useCallback(() => {
    const editor = getEditor();
    const selection = window.getSelection();
    const activeNode = selection?.anchorNode;
    return Boolean(editor && activeNode && editor.contains(activeNode.nodeType === Node.TEXT_NODE ? activeNode.parentElement : activeNode as Node));
  }, [getEditor]);

  const rememberEditorSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selectionIsInsideEditor()) return;
    savedEditorRangeRef.current = selection.getRangeAt(0).cloneRange();
  }, [selectionIsInsideEditor]);

  const restoreEditorSelection = useCallback(() => {
    const editor = getEditor();
    const selection = window.getSelection();
    if (!editor || !selection || !savedEditorRangeRef.current) return;
    editor.focus();
    selection.removeAllRanges();
    selection.addRange(savedEditorRangeRef.current);
  }, [getEditor]);

  const syncEditorContent = useCallback(() => {
    const editor = getEditor();
    editor?.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertHTML' }));
  }, [getEditor]);

  const loadLibraryImages = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'media'));
      const items: LibraryImage[] = [];
      snap.forEach((item) => {
        const data = item.data() as LibraryImage;
        if (data.url) items.push({ id: item.id, ...data });
      });
      items.sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
      setLibraryImages(items);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const openImageModal = useCallback(() => {
    rememberEditorSelection();
    setImageAltText('');
    setImageModalTab('upload');
    setImageModalOpen(true);
    loadLibraryImages();
  }, [loadLibraryImages, rememberEditorSelection]);

  const insertImageUrl = useCallback((url: string, altText = '') => {
    restoreEditorSelection();
    const cleanAlt = altText.replace(/"/g, '&quot;');
    const html = `<img src="${url}" alt="${cleanAlt}" class="my-6 w-full rounded-2xl" />`;
    document.execCommand('insertHTML', false, html);
    rememberEditorSelection();
    syncEditorContent();
    setImageModalOpen(false);
  }, [rememberEditorSelection, restoreEditorSelection, syncEditorContent]);

  const uploadEditorImage = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      window.alert('Please choose an image file.');
      return;
    }

    setImageUploading(true);
    try {
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const path = `blog/content/${Date.now()}-${cleanName}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file, { contentType: file.type });
      const url = await getDownloadURL(fileRef);
      const mediaDoc = {
        url,
        filename: cleanName,
        altText: imageAltText.trim(),
        uploadedAt: Date.now(),
        source: 'Blog editor',
        contentType: file.type,
        size: file.size,
        path,
      };
      const created = await addDoc(collection(db, 'media'), mediaDoc);
      setLibraryImages((current) => [{ id: created.id, ...mediaDoc }, ...current]);
      insertImageUrl(url, imageAltText.trim());
    } catch (error) {
      console.error(error);
      window.alert('Image upload failed. Check Firebase Storage and Firestore rules.');
    } finally {
      setImageUploading(false);
    }
  }, [imageAltText, insertImageUrl]);

  useEffect(() => {
    if (!userProfile?.isAdmin) return undefined;

    const sidebarSelector = '.admin-tiktok-shell aside.hidden.border-r.border-stone-200.bg-white';
    const sidebars = Array.from(document.querySelectorAll<HTMLElement>(sidebarSelector));
    const cleanups: Array<() => void> = [];

    sidebars.forEach((sidebar) => {
      sidebar.querySelector('.admin-sidebar-top-action')?.remove();
      sidebar.querySelector('.admin-extra-actions')?.remove();

      const topWrap = document.createElement('div');
      topWrap.className = 'admin-sidebar-top-action';

      const sendButton = document.createElement('button');
      sendButton.type = 'button';
      sendButton.className = 'admin-extra-action admin-extra-action-primary';
      sendButton.innerHTML = `<i class="las la-paper-plane"></i><span>${sending ? 'Sending...' : 'Send Update'}</span>`;
      sendButton.disabled = sending;

      const topDivider = document.createElement('div');
      topDivider.className = 'admin-extra-action-divider admin-extra-action-divider-top';

      const bottomWrap = document.createElement('div');
      bottomWrap.className = 'admin-extra-actions';

      const bottomDivider = document.createElement('div');
      bottomDivider.className = 'admin-extra-action-divider admin-extra-action-divider-bottom';

      const viewLink = document.createElement('a');
      viewLink.href = '/';
      viewLink.className = 'admin-extra-action';
      viewLink.innerHTML = '<i class="las la-globe"></i><span>View Site</span>';

      const logoutButton = document.createElement('button');
      logoutButton.type = 'button';
      logoutButton.className = 'admin-extra-action';
      logoutButton.innerHTML = '<i class="las la-sign-out-alt"></i><span>Sign Out</span>';

      const handleSend = () => openSendUpdateModal();
      const handleLogout = () => logout?.();

      const placeExtraActions = () => {
        if (sidebar.firstElementChild !== topWrap) sidebar.insertBefore(topWrap, sidebar.firstChild);
        if (sidebar.lastElementChild !== bottomWrap) sidebar.appendChild(bottomWrap);
      };

      sendButton.addEventListener('click', handleSend);
      logoutButton.addEventListener('click', handleLogout);

      topWrap.append(sendButton, topDivider);
      bottomWrap.append(bottomDivider, viewLink, logoutButton);
      placeExtraActions();

      const sidebarObserver = new MutationObserver(() => placeExtraActions());
      sidebarObserver.observe(sidebar, { childList: true });

      cleanups.push(() => {
        sidebarObserver.disconnect();
        sendButton.removeEventListener('click', handleSend);
        logoutButton.removeEventListener('click', handleLogout);
        topWrap.remove();
        bottomWrap.remove();
      });
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [logout, openSendUpdateModal, sending, userProfile?.isAdmin]);

  useEffect(() => {
    let savedRange: Range | null = null;

    const getToolbar = () => getEditor()?.previousElementSibling?.querySelector<HTMLElement>('.mt-4.flex.flex-wrap.gap-2') || null;
    const getToolbarButtons = () => Array.from(getToolbar()?.querySelectorAll<HTMLButtonElement>('button') || []);
    const getButtonFormat = (button: HTMLButtonElement) => button.dataset.adminFormat || button.textContent?.trim().toLowerCase() || '';

    const rememberSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || !selectionIsInsideEditor()) return;
      savedRange = selection.getRangeAt(0).cloneRange();
      savedEditorRangeRef.current = savedRange.cloneRange();
    };

    const restoreSelection = () => {
      const editor = getEditor();
      const selection = window.getSelection();
      if (!editor || !selection || !savedRange) return;
      editor.focus();
      selection.removeAllRanges();
      selection.addRange(savedRange);
    };

    const getBlockFormat = () => {
      try {
        return String(document.queryCommandValue('formatBlock') || '').replace(/[<>]/g, '').toLowerCase();
      } catch {
        return '';
      }
    };

    const addParagraphButton = () => {
      const toolbar = getToolbar();
      if (!toolbar || toolbar.querySelector('[data-admin-format="paragraph"]')) return;

      const paragraphButton = document.createElement('button');
      paragraphButton.type = 'button';
      paragraphButton.title = 'Paragraph';
      paragraphButton.dataset.adminFormat = 'paragraph';
      paragraphButton.className = 'admin-paragraph-button cursor-pointer rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-semibold hover:bg-stone-50';
      paragraphButton.innerHTML = '<i class="las la-paragraph text-lg"></i>';

      paragraphButton.addEventListener('mousedown', (event) => event.preventDefault());
      paragraphButton.addEventListener('click', () => {
        restoreSelection();
        document.execCommand('formatBlock', false, 'p');
        rememberSelection();
        syncEditorContent();
        window.setTimeout(setActiveToolbarButton, 0);
      });

      toolbar.insertBefore(paragraphButton, toolbar.firstElementChild);
    };

    const protectToolbarSelection = () => {
      getToolbarButtons().forEach((button) => {
        if (button.dataset.adminSelectionProtected === 'true') return;
        button.dataset.adminSelectionProtected = 'true';
        button.addEventListener('mousedown', (event) => event.preventDefault());
        button.addEventListener('click', (event) => {
          const isImageButton = Boolean(button.querySelector('.la-image'));
          if (isImageButton) {
            event.preventDefault();
            event.stopPropagation();
            (event as any).stopImmediatePropagation?.();
            savedEditorRangeRef.current = savedRange?.cloneRange() || savedEditorRangeRef.current;
            openImageModal();
            return;
          }

          restoreSelection();
          window.setTimeout(() => {
            rememberSelection();
            syncEditorContent();
            setActiveToolbarButton();
          }, 0);
        }, true);
      });
    };

    function setActiveToolbarButton() {
      const buttons = getToolbarButtons();
      if (!getEditor() || buttons.length === 0) return;

      const isInsideEditor = selectionIsInsideEditor();
      const blockFormat = getBlockFormat();

      let isBold = false;
      let isItalic = false;
      let isUnderline = false;
      let isList = false;
      try {
        isBold = document.queryCommandState('bold');
        isItalic = document.queryCommandState('italic');
        isUnderline = document.queryCommandState('underline');
        isList = document.queryCommandState('insertUnorderedList') || document.queryCommandState('insertOrderedList');
      } catch {
        // Ignore unsupported browser command states.
      }

      buttons.forEach((button) => {
        const format = getButtonFormat(button);
        let active = false;

        if (isInsideEditor) {
          if (format === 'h2') active = blockFormat === 'h2';
          else if (format === 'h3') active = blockFormat === 'h3';
          else if (format === 'h4') active = blockFormat === 'h4';
          else if (format === 'b') active = isBold;
          else if (format === 'i') active = isItalic;
          else if (format === 'u') active = isUnderline;
          else if (format === '•') active = isList;
          else if (format === 'paragraph') active = !['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'].includes(blockFormat);
          else if (format === 'quote') active = blockFormat === 'blockquote';
        }

        button.classList.toggle('admin-editor-button-active', active);
      });
    }

    const hydrateEditorToolbar = () => {
      addParagraphButton();
      protectToolbarSelection();
      setActiveToolbarButton();
    };

    const handleSelectionChange = () => {
      rememberSelection();
      setActiveToolbarButton();
    };

    const mutationObserver = new MutationObserver(hydrateEditorToolbar);

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('keyup', handleSelectionChange, true);
    document.addEventListener('mouseup', handleSelectionChange, true);
    document.addEventListener('input', handleSelectionChange, true);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    hydrateEditorToolbar();

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('keyup', handleSelectionChange, true);
      document.removeEventListener('mouseup', handleSelectionChange, true);
      document.removeEventListener('input', handleSelectionChange, true);
      mutationObserver.disconnect();
    };
  }, [getEditor, openImageModal, selectionIsInsideEditor, syncEditorContent]);

  useEffect(() => {
    const clickAddNewPost = () => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.admin-tiktok-shell button'));
      const addNewButton = buttons.find((button) => button.textContent?.trim().toLowerCase() === 'add new');
      addNewButton?.click();
    };

    const addPostsButton = () => {
      const headings = Array.from(document.querySelectorAll<HTMLHeadingElement>('.admin-tiktok-shell section h3'));
      const postsHeading = headings.find((heading) => heading.textContent?.trim().toLowerCase().startsWith('all posts'));
      const panel = postsHeading?.closest('section') as HTMLElement | null;
      if (!postsHeading || !panel || panel.querySelector('.admin-add-post-button')) return;

      panel.classList.add('admin-posts-panel');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'admin-add-post-button';
      button.innerHTML = '<span>+ Add Post</span>';
      button.addEventListener('click', clickAddNewPost);
      panel.appendChild(button);
    };

    const mutationObserver = new MutationObserver(addPostsButton);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    addPostsButton();

    return () => {
      mutationObserver.disconnect();
      document.querySelectorAll('.admin-add-post-button').forEach((button) => button.remove());
    };
  }, []);

  return (
    <div className="admin-tiktok-shell">
      <AdminUserDashboard />

      {notificationModalOpen && (
        <div className="admin-notification-modal-backdrop" onClick={() => setNotificationModalOpen(false)}>
          <div className="admin-notification-modal" onClick={(event) => event.stopPropagation()}>
            {notificationStep === 'form' ? (
              <>
                <div className="admin-notification-modal-header">
                  <button type="button" onClick={() => setNotificationModalOpen(false)}>← Back to overview</button>
                  <span>/</span>
                  <strong>Send notification</strong>
                </div>
                <div className="admin-notification-modal-body">
                  <label className="admin-notification-label">Send to</label>
                  <div className="admin-notification-target-grid">
                    <button
                      type="button"
                      className={notificationTarget === 'all' ? 'active' : ''}
                      onClick={() => setNotificationTarget('all')}
                    >
                      <strong>All users</strong>
                      <span>{loadingNotificationUsers ? 'Loading recipients...' : `${notificationUsers.length} recipients`}</span>
                    </button>
                    <button
                      type="button"
                      className={notificationTarget === 'specific' ? 'active' : ''}
                      onClick={() => setNotificationTarget('specific')}
                    >
                      <strong>Specific user</strong>
                      <span>{selectedNotificationUser ? selectedNotificationUser.displayName || selectedNotificationUser.email : 'Search by name or email'}</span>
                    </button>
                  </div>

                  {notificationTarget === 'specific' && (
                    <div className="admin-notification-user-picker">
                      <input value={notificationUserSearch} onChange={(event) => setNotificationUserSearch(event.target.value)} placeholder="Search registered users..." />
                      <div>
                        {filteredNotificationUsers.map((item) => (
                          <button key={item.uid} type="button" className={selectedNotificationUserId === item.uid ? 'active' : ''} onClick={() => setSelectedNotificationUserId(item.uid)}>
                            <strong>{item.displayName || 'Unnamed user'}</strong>
                            <span>{item.email}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <label className="admin-notification-label" htmlFor="admin-notification-subject">Subject</label>
                  <input
                    id="admin-notification-subject"
                    className="admin-notification-input"
                    value={notificationSubject}
                    onChange={(event) => setNotificationSubject(event.target.value)}
                    placeholder="System maintenance on Sunday"
                  />

                  <label className="admin-notification-label" htmlFor="admin-notification-message">Message</label>
                  <textarea
                    id="admin-notification-message"
                    className="admin-notification-textarea"
                    value={notificationMessage}
                    onChange={(event) => setNotificationMessage(event.target.value)}
                    placeholder="Write the notification message..."
                  />

                  <div className="admin-notification-actions">
                    <button type="button" disabled={!canReviewNotification} onClick={() => setNotificationStep('confirm')} className="admin-notification-primary">→ Review before sending</button>
                    <button type="button" onClick={() => setNotificationModalOpen(false)} className="admin-notification-secondary">Cancel</button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="admin-notification-modal-header">
                  <button type="button" onClick={() => setNotificationStep('form')}>← Edit notification</button>
                  <span>/</span>
                  <strong>Confirm</strong>
                </div>
                <div className="admin-notification-modal-body">
                  <div className="admin-notification-summary">
                    <div><span>Send to</span><strong><i className="las la-users" /> {notificationTarget === 'all' ? `All users — ${notificationRecipientCount} recipients` : `${selectedNotificationUser?.displayName || selectedNotificationUser?.email || 'Specific user'} — 1 recipient`}</strong></div>
                    <div><span>Subject</span><strong>{notificationSubject.trim()}</strong></div>
                    <div><span>Message</span><p>{notificationMessage.trim()}</p></div>
                  </div>
                  <div className="admin-notification-warning"><i className="las la-exclamation-triangle" /> This will create {notificationRecipientCount} notification {notificationRecipientCount === 1 ? 'document' : 'documents'} in Firestore. This action cannot be undone.</div>
                  <div className="admin-notification-actions">
                    <button type="button" disabled={sending} onClick={sendReviewedNotification} className="admin-notification-primary"><i className="las la-paper-plane" /> {sending ? 'Sending...' : `Send to ${notificationRecipientCount} ${notificationRecipientCount === 1 ? 'user' : 'users'}`}</button>
                    <button type="button" disabled={sending} onClick={() => setNotificationStep('form')} className="admin-notification-secondary">← Edit</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {imageModalOpen && (
        <div className="admin-image-modal-backdrop" onClick={() => setImageModalOpen(false)}>
          <div className="admin-image-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-image-modal-header">
              <div>
                <h2>Add image</h2>
                <p>Upload a new image or insert one from the media library.</p>
              </div>
              <button type="button" onClick={() => setImageModalOpen(false)}><i className="las la-times" /></button>
            </div>

            <div className="admin-image-tabs">
              <button type="button" className={imageModalTab === 'upload' ? 'active' : ''} onClick={() => setImageModalTab('upload')}>Upload</button>
              <button type="button" className={imageModalTab === 'library' ? 'active' : ''} onClick={() => { setImageModalTab('library'); loadLibraryImages(); }}>Library</button>
            </div>

            {imageModalTab === 'upload' ? (
              <div className="admin-image-upload-panel">
                <label className="admin-image-alt-label">
                  Alt text
                  <input value={imageAltText} onChange={(event) => setImageAltText(event.target.value)} placeholder="Describe this image" />
                </label>
                <label
                  className="admin-image-dropzone"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const file = event.dataTransfer.files?.[0];
                    if (file) uploadEditorImage(file);
                  }}
                >
                  <input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) uploadEditorImage(file); }} />
                  <i className="las la-cloud-upload-alt" />
                  <strong>{imageUploading ? 'Uploading...' : 'Drag image here or click to upload'}</strong>
                  <span>Image will be saved to Firebase Storage and inserted into the post.</span>
                </label>
              </div>
            ) : (
              <div className="admin-image-library-panel">
                {libraryImages.length > 0 ? libraryImages.map((image) => (
                  <button key={image.id} type="button" onClick={() => insertImageUrl(image.url, image.altText || image.filename || '')}>
                    <img src={image.url} alt={image.altText || image.filename || 'Library image'} />
                    <span>{image.altText || image.filename || 'Image'}</span>
                  </button>
                )) : <p className="admin-image-empty">No images in the media library yet. Upload one first.</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserDashboardStyled;
