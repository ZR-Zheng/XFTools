import type { PdfAsset, PdfPageInstance } from '../shared/page-plan';

export type ExportMode = 'all' | 'selection' | 'split';

export function readPageGroups(ranges: string, pageCount: number) {
  if (!ranges.trim() || !pageCount) return [];
  return ranges
    .replace(/，/g, ',')
    .split(',')
    .map((part) => {
      const match = /^(\d+)\s*(?:[-–]\s*(\d+))?$/.exec(part.trim());
      if (!match) throw new Error('invalid range');
      const first = Number(match[1]);
      const last = Number(match[2] ?? match[1]);
      if (first < 1 || last < first || last > pageCount)
        throw new Error('out of range');
      return { first, last };
    });
}

export function originalSource(
  sources: readonly PdfAsset[],
  pages: readonly PdfPageInstance[]
) {
  const source = sources.find(({ id }) => id === pages[0]?.sourceId);
  return source &&
    source.pageCount === pages.length &&
    new Set(pages.map((page) => page.pageIndex)).size === pages.length &&
    pages.every(
      (page) =>
        page.sourceId === source.id &&
        page.pageIndex >= 0 &&
        page.pageIndex < source.pageCount
    )
    ? source
    : undefined;
}

export function willCopyPages(
  sources: readonly PdfAsset[],
  pages: readonly PdfPageInstance[],
  bookmarks: boolean
) {
  return bookmarks || !originalSource(sources, pages);
}
