import type { PDFDocument } from 'pdf-lib';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PageEdit } from './page-edits';

export interface PdfAsset {
  id: string;
  name: string;
  file: File;
  pageCount: number;
  sizes: { width: number; height: number; rotation: number }[];
  document?: PDFDocument;
  hasForms?: boolean;
  preview?: Promise<PDFDocumentProxy>;
  disposePreview?: () => void;
}
export interface PdfPageInstance {
  id: string;
  sourceId: string | null;
  pageIndex: number;
  rotation: 0 | 90 | 180 | 270;
  blankSize?: { width: number; height: number };
  edits?: readonly PageEdit[];
}
export interface PdfWorkspace {
  sources: PdfAsset[];
  pages: PdfPageInstance[];
}

export function sourcePages(
  sourceId: string,
  count: number
): PdfPageInstance[] {
  return Array.from({ length: count }, (_, pageIndex) => ({
    id: crypto.randomUUID(),
    sourceId,
    pageIndex,
    rotation: 0
  }));
}
export function rotatePages(
  pages: PdfPageInstance[],
  ids: ReadonlySet<string>
): PdfPageInstance[] {
  return pages.map((page) =>
    ids.has(page.id)
      ? {
          ...page,
          rotation: ((page.rotation + 90) % 360) as PdfPageInstance['rotation']
        }
      : page
  );
}
export function duplicatePages(
  pages: PdfPageInstance[],
  ids: ReadonlySet<string>
): PdfPageInstance[] {
  return pages.flatMap((page) =>
    ids.has(page.id) ? [page, { ...page, id: crypto.randomUUID() }] : [page]
  );
}
export function movePages(
  pages: PdfPageInstance[],
  ids: ReadonlySet<string>,
  direction: -1 | 1
): PdfPageInstance[] {
  if (pages.length < 2) return pages;
  const next = [...pages];
  const start = direction === -1 ? 1 : next.length - 2,
    end = direction === -1 ? next.length : -1;
  for (let i = start; i !== end; i -= direction) {
    const target = i + direction;
    if (ids.has(next[i].id) && !ids.has(next[target].id))
      [next[i], next[target]] = [next[target], next[i]];
  }
  return next;
}
export function movePagesRelative(
  pages: PdfPageInstance[],
  ids: ReadonlySet<string>,
  targetId: string,
  side: 'before' | 'after' = 'before'
): PdfPageInstance[] {
  if (!ids.size || ids.has(targetId)) return pages;
  const moved = pages.filter((page) => ids.has(page.id)),
    remaining = pages.filter((page) => !ids.has(page.id));
  const index = remaining.findIndex((page) => page.id === targetId);
  if (index < 0) return pages;
  const insertion = side === 'after' ? index + 1 : index;
  const next = [
    ...remaining.slice(0, insertion),
    ...moved,
    ...remaining.slice(insertion)
  ];
  return next.every((page, index) => page === pages[index]) ? pages : next;
}
export function groupBySources(
  pages: PdfPageInstance[],
  sources: { id: string }[]
): PdfPageInstance[] {
  const order = new Map(sources.map((source, index) => [source.id, index]));
  return [...pages].sort(
    (a, b) =>
      (order.get(a.sourceId || '') ?? sources.length) -
      (order.get(b.sourceId || '') ?? sources.length)
  );
}
