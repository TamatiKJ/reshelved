import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Listing, Message, UserProfile } from '../types';

type AdminMediaItem = {
  id: string;
  title: string;
  source: string;
  url: string;
};

const isImageUrl = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

const AdminUploadedMediaBridge: React.FC = () => {
  const { userProfile } = useAuth() as any;
  const [items, setItems] = useState<AdminMediaItem[]>([]);
  const isAdmin = Boolean(userProfile?.isAdmin);

  const loadUploadedMedia = useCallback(async () => {
    if (!isAdmin) return;

    const [userSnap, listingSnap, messageSnap, mediaSnap] = await Promise.all([
      getDocs(collection(db, 'users')).catch(() => null),
      getDocs(collection(db, 'listings')).catch(() => null),
      getDocs(collection(db, 'messages')).catch(() => null),
      getDocs(collection(db, 'media')).catch(() => null),
    ]);

    const nextItems: AdminMediaItem[] = [];
    const seenUrls = new Set<string>();

    const pushItem = (item: AdminMediaItem) => {
      if (!isImageUrl(item.url) || seenUrls.has(item.url)) return;
      seenUrls.add(item.url);
      nextItems.push(item);
    };

    userSnap?.forEach((docItem) => {
      const user = { uid: docItem.id, ...docItem.data() } as UserProfile;
      if (user.photoURL) {
        pushItem({
          id: `user-${user.uid}`,
          title: `${user.displayName || user.email || 'User'} profile photo`,
          source: 'User profile upload',
          url: user.photoURL,
        });
      }
    });

    listingSnap?.forEach((docItem) => {
      const listing = { id: docItem.id, ...docItem.data() } as Listing;
      if (Array.isArray(listing.images)) {
        listing.images.forEach((url, index) => {
          if (isImageUrl(url)) {
            pushItem({
              id: `listing-${listing.id}-${index}`,
              title: listing.title || 'Listing image',
              source: 'Listing upload',
              url,
            });
          }
        });
      }
    });

    messageSnap?.forEach((docItem) => {
      const message = { id: docItem.id, ...docItem.data() } as Message;
      const url = message.imageUrl || message.imageData;
      if (isImageUrl(url)) {
        pushItem({
          id: `message-${message.id}`,
          title: message.imageName || 'Message image',
          source: 'Message upload',
          url,
        });
      }
    });

    mediaSnap?.forEach((docItem) => {
      const data = docItem.data() as any;
      if (isImageUrl(data.url)) {
        pushItem({
          id: `media-${docItem.id}`,
          title: data.filename || data.title || 'Uploaded media',
          source: data.source || 'Media library upload',
          url: data.url,
        });
      }
    });

    setItems(nextItems);
  }, [isAdmin]);

  const uploadedCards = useMemo(() => items.map((item) => `
    <article class="admin-uploaded-media-card overflow-hidden rounded-2xl border border-stone-200 bg-white" data-admin-uploaded-media="${item.id}">
      <div class="aspect-square bg-stone-100">
        <img src="${item.url}" alt="${item.title.replace(/"/g, '&quot;')}" class="h-full w-full object-cover" loading="lazy" />
      </div>
      <div class="space-y-1 p-4 text-sm">
        <p class="truncate font-bold text-stone-950">${item.title}</p>
        <p class="text-stone-500">${item.source}</p>
      </div>
    </article>
  `).join(''), [items]);

  useEffect(() => {
    if (!isAdmin) return undefined;
    loadUploadedMedia().catch((error) => console.error('Admin uploaded media load failed:', error));

    const hydrateMediaTab = () => {
      const panel = Array.from(document.querySelectorAll<HTMLElement>('.admin-tiktok-shell section'))
        .find((section) => section.querySelector('h3')?.textContent?.trim() === 'Media Library');
      if (!panel) return;

      const grid = panel.querySelector<HTMLElement>('.grid.grid-cols-1.gap-4');
      if (!grid) return;

      grid.querySelectorAll('[data-admin-uploaded-media]').forEach((node) => node.remove());
      if (!items.length) return;

      const empty = Array.from(grid.querySelectorAll<HTMLElement>('.col-span-full'))
        .find((node) => node.textContent?.includes('No images found'));
      empty?.remove();

      grid.insertAdjacentHTML('afterbegin', uploadedCards);
    };

    hydrateMediaTab();
    const observer = new MutationObserver(() => window.setTimeout(hydrateMediaTab, 50));
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [isAdmin, items.length, loadUploadedMedia, uploadedCards]);

  return null;
};

export default AdminUploadedMediaBridge;
