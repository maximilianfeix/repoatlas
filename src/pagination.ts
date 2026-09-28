export interface PageWindow<T> {
  page: number;
  pageCount: number;
  start: number;
  end: number;
  items: readonly T[];
}

/** Return a bounded, zero-based slice suitable for stable inspector pagination. */
export function pageWindow<T>(items: readonly T[], requestedPage: number, pageSize = 20): PageWindow<T> {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) throw new Error('Page size must be a positive whole number.');
  if (!Number.isSafeInteger(requestedPage)) throw new Error('Page index must be a whole number.');
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.max(0, Math.min(requestedPage, pageCount - 1));
  const start = page * pageSize;
  const end = Math.min(start + pageSize, items.length);
  return { page, pageCount, start, end, items: items.slice(start, end) };
}
