import React from 'react';
import type { Listing } from '../../types';
import { CONDITIONS } from '../../types';
import LocationCombobox from '../LocationCombobox';
import type { ListingCategory } from '../../services/listingCategories';

type EditListingDetailsStepProps = {
  title: string;
  author: string;
  description: string;
  condition: Listing['condition'];
  category: string;
  type: Listing['type'];
  price: string;
  location: string;
  saving: boolean;
  categoriesLoading: boolean;
  listingCategories: ListingCategory[];
  selectedCategory?: ListingCategory;
  fieldClass: string;
  labelClass: string;
  listingTypes: ReadonlyArray<{
    value: Listing['type'];
    label: string;
    icon: string;
    desc: string;
  }>;
  setTitle: (value: string) => void;
  setAuthor: (value: string) => void;
  setDescription: (value: string) => void;
  setCondition: (value: Listing['condition']) => void;
  setCategory: (value: string) => void;
  setType: (value: Listing['type']) => void;
  setPrice: (value: string) => void;
  setLocation: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
};

const EditListingDetailsStep: React.FC<EditListingDetailsStepProps> = ({
  title,
  author,
  description,
  condition,
  category,
  type,
  price,
  location,
  saving,
  categoriesLoading,
  listingCategories,
  selectedCategory,
  fieldClass,
  labelClass,
  listingTypes,
  setTitle,
  setAuthor,
  setDescription,
  setCondition,
  setCategory,
  setType,
  setPrice,
  setLocation,
  onBack,
  onNext
}) => (
  <div>
    <h2 className="text-2xl font-bold text-stone-950">Book Details</h2>

    <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
      <div>
        <label className={labelClass}>Book Title *</label>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={saving}
          className={fieldClass}
        />
      </div>

      <div>
        <label className={labelClass}>Author *</label>
        <input
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
          disabled={saving}
          className={fieldClass}
        />
      </div>

      <div className="sm:col-span-2">
        <label className={labelClass}>Description *</label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={saving}
          rows={4}
          className={`${fieldClass} resize-none`}
        />
      </div>
    </div>

    <h2 className="mt-8 text-2xl font-bold text-stone-950">Listing Type</h2>

    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      {listingTypes.map((item) => (
        <button
          key={item.value}
          type="button"
          disabled={saving}
          onClick={() => setType(item.value)}
          className={`cursor-pointer rounded-2xl border p-4 text-left transition disabled:opacity-60 ${
            type === item.value
              ? 'border-primary-600 bg-primary-50/60 ring-1 ring-primary-600/10'
              : 'border-stone-200 bg-white hover:border-primary-600'
          }`}
        >
          <i className={`${item.icon} text-3xl text-stone-950`} />
          <div className="mt-3 text-sm font-bold text-stone-950">{item.label}</div>
          <div className="mt-1 text-xs leading-5 text-stone-500">{item.desc}</div>
        </button>
      ))}
    </div>

    <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
      <div>
        <label className={labelClass}>Condition *</label>
        <select
          value={condition}
          onChange={(event) => setCondition(event.target.value as Listing['condition'])}
          disabled={saving}
          className={`${fieldClass} pr-10`}
        >
          {CONDITIONS.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Category *</label>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          disabled={saving || categoriesLoading}
          className={`${fieldClass} pr-10`}
        >
          <option value="" disabled>
            {categoriesLoading ? 'Loading categories...' : 'Select category'}
          </option>
          {category && !selectedCategory && <option value={category}>{category}</option>}
          {listingCategories.map((item) => (
            <option key={item.id} value={item.name}>{item.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Location *</label>
        <LocationCombobox
          value={location}
          onChange={setLocation}
          disabled={saving}
          required
          className={`${fieldClass} pr-11`}
          placeholder="Search location"
        />
      </div>

      {type === 'sell' && (
        <div>
          <label className={labelClass}>Price (KSh) *</label>
          <input
            type="number"
            min="1"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            disabled={saving}
            className={fieldClass}
          />
        </div>
      )}
    </div>

    <div className="mt-6 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        disabled={saving}
        className="cursor-pointer rounded-lg border border-stone-200 px-8 py-3 text-sm font-bold text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
      >
        Back
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={saving}
        className="cursor-pointer rounded-lg bg-primary-600 px-8 py-3 text-sm font-bold text-white transition hover:bg-primary-700 disabled:opacity-50"
      >
        Next Step
      </button>
    </div>
  </div>
);

export default EditListingDetailsStep;
