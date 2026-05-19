import { z } from 'zod';
import type { Listing } from '../types';

const numberFromUnknown = z.preprocess((value) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return value;
}, z.number().finite());

const optionalNumberFromUnknown = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return value;
}, z.number().finite().optional());

export const listingSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).catch('Untitled book'),
  author: z.string().trim().min(1).catch('Unknown author'),
  description: z.string().trim().catch(''),
  condition: z.enum(['New', 'Like New', 'Good', 'Fair', 'Poor']).catch('Good'),
  category: z.string().trim().min(1).catch('Other'),
  type: z.enum(['swap', 'donate', 'sell']).catch('swap'),
  price: optionalNumberFromUnknown,
  images: z.array(z.string().url()).catch([]),
  userId: z.string().trim().min(1).catch(''),
  userName: z.string().trim().min(1).catch('Unknown user'),
  userPhoto: z.string().optional().catch(undefined),
  location: z.string().trim().min(1).catch('Other'),
  createdAt: numberFromUnknown.catch(0),
  expiresAt: numberFromUnknown.catch(0),
  active: z.boolean().catch(false),
  flagged: z.boolean().catch(false),
  flagCount: numberFromUnknown.catch(0)
});

export const listingWriteSchema = listingSchema.omit({ id: true }).extend({
  title: z.string().trim().min(1, 'Title is required'),
  author: z.string().trim().min(1, 'Author is required'),
  description: z.string().trim().min(1, 'Description is required'),
  userId: z.string().trim().min(1, 'User ID is required'),
  userName: z.string().trim().min(1, 'User name is required'),
  location: z.string().trim().min(1, 'Location is required'),
  category: z.string().trim().min(1, 'Category is required'),
  images: z.array(z.string()).min(1, 'At least one image is required')
});

export type ValidatedListing = z.infer<typeof listingSchema> & Listing;
export type ListingWriteInput = z.infer<typeof listingWriteSchema>;
