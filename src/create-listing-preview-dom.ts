const getFieldLabel = (select: HTMLSelectElement) => {
  const container = select.closest('div');
  const label = container?.querySelector('label')?.textContent?.toLowerCase() || '';
  if (label.includes('condition')) return 'condition';
  if (label.includes('location')) return 'location';
  if (label.includes('category')) return 'category';
  return '';
};

const state = {
  conditionTouched: false,
  locationTouched: false,
  categoryTouched: false
};

const setSpanText = (span: HTMLElement | null, value: string) => {
  if (!span) return;
  const icon = span.querySelector('i');
  span.textContent = '';
  if (icon) span.appendChild(icon);
  span.appendChild(document.createTextNode(value));
};

const findPreviewSpan = (iconClass: string) => document.querySelector<HTMLElement>(`form aside i.${iconClass}`)?.closest('span') as HTMLElement | null;

export const syncCreateListingPreviewPlaceholders = () => {
  const form = document.querySelector('form');
  if (!form?.querySelector('aside')) return;

  const selects = Array.from(form.querySelectorAll<HTMLSelectElement>('select'));
  const conditionSelect = selects.find((select) => getFieldLabel(select) === 'condition');
  const locationSelect = selects.find((select) => getFieldLabel(select) === 'location');
  const categorySelect = selects.find((select) => getFieldLabel(select) === 'category');

  const conditionSpan = findPreviewSpan('la-check-circle');
  const locationSpan = findPreviewSpan('la-map-marker');
  const categorySpan = findPreviewSpan('la-book');

  if (!state.conditionTouched) setSpanText(conditionSpan, 'Condition');
  else if (conditionSelect) setSpanText(conditionSpan, conditionSelect.value || 'Condition');

  if (!state.locationTouched) setSpanText(locationSpan, 'Location');
  else if (locationSelect) setSpanText(locationSpan, locationSelect.value || 'Location');

  if (!state.categoryTouched) setSpanText(categorySpan, 'Category');
  else if (categorySelect) setSpanText(categorySpan, categorySelect.value || 'Category');
};

const handleCreateListingSelectChange = (event: Event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  if (!target.closest('form')?.querySelector('aside')) return;

  const field = getFieldLabel(target);
  if (field === 'condition') state.conditionTouched = true;
  if (field === 'location') state.locationTouched = true;
  if (field === 'category') state.categoryTouched = true;
  window.setTimeout(syncCreateListingPreviewPlaceholders, 0);
};

document.addEventListener('change', handleCreateListingSelectChange, true);
new MutationObserver(syncCreateListingPreviewPlaceholders).observe(document.body, { childList: true, subtree: true });
