export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  bio?: string;
  location?: string;
  phone?: string;
  bookmarks?: string[];
  blockedUsers?: string[];
  isAdmin: boolean;
  flagged: boolean;
  flagCount: number;
  createdAt: number;
  online?: boolean;
  lastSeen?: number;
  deactivated?: boolean;
}

export interface Listing {
  id: string;
  title: string;
  author: string;
  description: string;
  condition: 'New' | 'Like New' | 'Good' | 'Fair' | 'Poor';
  category: string;
  type: 'swap' | 'donate' | 'sell';
  price?: number;
  images: string[];
  userId: string;
  userName: string;
  userPhoto?: string;
  location: string;
  createdAt: number;
  expiresAt: number;
  active: boolean;
  flagged: boolean;
  flagCount: number;
}

export interface Conversation {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  participantPhotos: Record<string, string>;
  listingId: string;
  listingTitle: string;
  listingImage?: string;
  listingPrice?: number;
  listingType?: 'swap' | 'donate' | 'sell';
  lastMessage: string;
  lastMessageAt: number;
  createdAt: number;
  updatedAt?: number;
  buyerId?: string;
  sellerId?: string;
  conversationKey?: string;
  hiddenFor?: string[];
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  recipientId?: string;
  text: string;
  createdAt: number;
  type?: 'text' | 'image' | 'map';
  imageData?: string;
  imageUrl?: string;
  imageName?: string;
  imageSize?: number;
  storagePath?: string;
  lat?: number;
  lng?: number;
  mapUrl?: string;
  readBy?: string[];
  deletedFor?: string[];
  deleted?: boolean;
}

export interface Rating {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  listingId: string;
  listingTitle: string;
  rating: number;
  title?: string;
  review: string;
  createdAt: number;
}

export interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: 'listing' | 'user';
  targetId: string;
  targetName: string;
  reason: string;
  details: string;
  createdAt: number;
  resolved: boolean;
}

export interface Contact {
  id: string;
  userId: string;
  listingId: string;
  listingTitle: string;
  sellerId: string;
  sellerName: string;
  contactedAt: number;
  reviewPromptShown: boolean;
  reviewed: boolean;
}

export const CATEGORIES = [
  'Fiction',
  'Fantasy',
  'Non-Fiction',
  'Children',
  'Science & Technology',
  'Business & Economics',
  'Arts & Culture',
  'Self-Help',
  'Religion & Spirituality',
  'History',
  'Biography',
  'Other'
];

export const KENYAN_CITIES = [
  'Lavington',
  'Kileleshwa',
  'Langata',
  'Syokimau',
  'Kasarani',
  'Kilimani',
  'Westlands',
  'Ruaka',
  'CBD',
  'Ngara',
  'Embakasi',
  'Ruiru',
  'South B',
  'South C',
  'Parklands',
  'Karen',
  'Upper Hill',
  'Roysambu',
  'Kahawa',
  'Other'
];

export const CONDITIONS: Listing['condition'][] = ['New', 'Like New', 'Good', 'Fair', 'Poor'];
