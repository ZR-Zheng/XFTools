import { degrees, PDFDocument } from 'pdf-lib';
import { exportPagePlan, pdfFilename } from '../shared/export-page-plan';
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

function originalSource(
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

type ExportOptions = {
  filename: string;
  bookmarks: boolean;
  signal: AbortSignal;
  onProgress?: (done: number, total: number) => void;
};

export async function exportWorkspacePdf(
  sources: readonly PdfAsset[],
  pages: readonly PdfPageInstance[],
  options: ExportOptions
) {
  const hasEdits = pages.some((page) => page.edits?.length);
  const prepare = hasEdits
    ? async (document: PDFDocument) => {
        const { writePageEdits } = await import('./write-edits');
        await writePageEdits(document, pages, options.signal);
      }
    : undefined;
  const source = !options.bookmarks && originalSource(sources, pages);
  if (!source) return exportPagePlan(sources, pages, { ...options, prepare });
  options.signal.throwIfAborted();
  const filename = pdfFilename(options.filename);
  const sameOrder = pages.every((page, index) => page.pageIndex === index);
  if (!hasEdits && sameOrder && pages.every((page) => page.rotation === 0))
    return new File([source.file], filename, { type: 'application/pdf' });
  const original = await PDFDocument.load(await source.file.arrayBuffer(), {
    updateMetadata: false
  });
  const originalPages = original.getPages();
  const arranged = pages.map(({ pageIndex }) => originalPages[pageIndex]);
  if (!sameOrder) {
    for (let index = originalPages.length - 1; index >= 0; index--)
      original.removePage(index);
    arranged.forEach((page) => original.addPage(page));
  }
  pages.forEach(({ rotation }, index) => {
    if (!rotation) return;
    const page = arranged[index];
    page.setRotation(degrees((page.getRotation().angle + rotation) % 360));
  });
  options.signal.throwIfAborted();
  await prepare?.(original);
  const bytes = await original.save({ updateFieldAppearances: false });
  options.signal.throwIfAborted();
  return new File([bytes as BlobPart], filename, { type: 'application/pdf' });
}

export function willCopyPages(
  sources: readonly PdfAsset[],
  pages: readonly PdfPageInstance[],
  bookmarks: boolean
) {
  return bookmarks || !originalSource(sources, pages);
}

export async function exportWorkspaceGroups(
  sources: readonly PdfAsset[],
  groups: readonly (readonly PdfPageInstance[])[],
  options: ExportOptions
) {
  if (groups.length === 1)
    return exportWorkspacePdf(sources, groups[0], options);
  const { default: JSZip } = await import('jszip');
  const archive = new JSZip();
  const base = pdfFilename(options.filename).slice(0, -4);
  const digits = String(groups.length).length;
  for (const [index, pages] of groups.entries()) {
    options.signal.throwIfAborted();
    const filename = `${base}-${String(index + 1).padStart(digits, '0')}.pdf`;
    const file = await exportWorkspacePdf(sources, pages, {
      ...options,
      filename,
      onProgress: undefined
    });
    archive.file(file.name, await file.arrayBuffer());
    options.onProgress?.(index + 1, groups.length);
  }
  const bytes = await archive.generateAsync({ type: 'arraybuffer' });
  options.signal.throwIfAborted();
  return new File([bytes], `${base}.zip`, { type: 'application/zip' });
}
