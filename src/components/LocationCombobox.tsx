import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocations } from '../hooks/useLocations';

type LocationComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  includeAllOption?: boolean;
  allOptionLabel?: string;
  allOptionValue?: string;
};

const asSafeText = (value: unknown) => typeof value === 'string' ? value : '';

const LocationCombobox: React.FC<LocationComboboxProps> = ({
  value,
  onChange,
  disabled = false,
  required = false,
  placeholder = 'Search location',
  className = '',
  includeAllOption = false,
  allOptionLabel = 'All Locations',
  allOptionValue = 'all'
}) => {
  const { locations, loading } = useLocations();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const safeValue = asSafeText(value);
  const selectedLabel = includeAllOption && safeValue === allOptionValue ? allOptionLabel : safeValue;
  const selectedLabelLower = selectedLabel.toLowerCase();

  useEffect(() => {
    if (!open) setQuery(selectedLabel);
  }, [open, selectedLabel]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  const options = useMemo(() => {
    const locationOptions = locations
      .map((location) => ({ key: asSafeText(location.id), name: asSafeText(location.name) }))
      .filter((location) => location.name.trim());

    return includeAllOption
      ? [{ key: allOptionValue, name: allOptionLabel }, ...locationOptions]
      : locationOptions;
  }, [locations, includeAllOption, allOptionValue, allOptionLabel]);

  const filteredOptions = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery || cleanQuery === selectedLabelLower) return options.slice(0, 8);
    return options.filter((option) => option.name.toLowerCase().includes(cleanQuery)).slice(0, 8);
  }, [options, query, selectedLabelLower]);

  const chooseLocation = (name: string) => {
    const nextValue = includeAllOption && name === allOptionLabel ? allOptionValue : name;
    onChange(nextValue);
    setQuery(name);
    setOpen(false);
  };

  const resetInvalidText = () => {
    window.setTimeout(() => {
      const cleanQuery = query.trim();
      const match = options.find((option) => option.name === cleanQuery);
      if (match) chooseLocation(match.name);
      else setQuery(selectedLabel);
    }, 120);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={open ? query : selectedLabel}
        onFocus={() => { if (!disabled) { setOpen(true); setQuery(''); } }}
        onBlur={resetInvalidText}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'Enter' && filteredOptions[0]) {
            event.preventDefault();
            chooseLocation(filteredOptions[0].name);
          }
        }}
        disabled={disabled}
        required={required}
        placeholder={loading ? 'Loading locations...' : placeholder}
        autoComplete="off"
        className={className}
        role="combobox"
        aria-expanded={open}
      />
      <i className="las la-search pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg text-stone-400" />
      {open && !disabled && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-64 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-1 shadow-xl">
          {filteredOptions.length > 0 ? filteredOptions.map((option) => (
            <button
              key={option.key || option.name}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseLocation(option.name)}
              className={`flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-stone-50 ${option.name === selectedLabel ? 'bg-[#1665CC]/10 text-[#1665CC]' : 'text-stone-700'}`}
            >
              <i className="las la-map-marker text-base text-stone-400" />
              {option.name}
            </button>
          )) : <div className="px-3 py-3 text-sm text-stone-500">No matching location</div>}
        </div>
      )}
    </div>
  );
};

export default LocationCombobox;
