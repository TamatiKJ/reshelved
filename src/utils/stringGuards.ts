export const safeString = (value: unknown): string => {
  return typeof value === 'string' ? value : '';
};

export const safeLower = (value: unknown): string => {
  return safeString(value).toLowerCase();
};
