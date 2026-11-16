import { PDFDocument, PDFHexString, PDFName, PDFPage, degrees } from 'pdf-lib';
import type { PdfAsset, PdfPageInstance } from './page-plan';

function fileBookmarks(
  document: PDFDocument,
  entries: { title: string; index: number }[]
) {
  if (!entries.length) return;
  const context = document.context;
  const outline = context.obj({ Type: 'Outlines', Count: entries.length });
  const outlineRef = context.register(outline);
  const items = entries.map((entry) =>
    context.obj({
      Title: PDFHexString.fromText(entry.title),
      Parent: outlineRef,
      Dest: [document.getPage(entry.index).ref, PDFName.of('Fit')]
    })
  );
  const refs = items.map((item) => context.register(item));
  items.forEach((item, index) => {
    if (index) item.set(PDFName.of('Prev'), refs[index - 1]);
    if (index + 1 < refs.length) item.set(PDFName.of('Next'), refs[index + 1]);
  });
  outline.set(PDFName.of('First'), refs[0]);
  outline.set(PDFName.of('Last'), refs.at(-1)!);
  document.catalog.set(PDFName.of('Outlines'), outlineRef);
}

export async function exportPagePlan(
  sources: readonly PdfAsset[],
  pages: readonly PdfPageInstance[],
  options: {
    filename?: string;
    bookmarks?: boolean;
    signal?: AbortSignal;
    onProgress?: (done: number, total: number) => void;
  } = {}
): Promise<File> {
  if (!pages.length) throw new Error('Select at least one page.');
  const check = () => options.signal?.throwIfAborted();
  check();
  const output = await PDFDocument.create();
  const prepared = new Set<string>();
  const copies = new Map<string, PDFPage>();
  const bookmarks: { title: string; index: number }[] = [];
  for (const [index, page] of pages.entries()) {
    check();
    if (page.sourceId === null) {
      const size = page.blankSize || { width: 595.28, height: 841.89 };
      if (!(size.width > 0 && size.height > 0))
        throw new Error('Invalid blank page size.');
      output
        .addPage([size.width, size.height])
        .setRotation(degrees(page.rotation));
    } else {
      const source = sources.find((source) => source.id === page.sourceId);
      if (!source) throw new Error('A source PDF is missing.');
      if (!prepared.has(source.id)) {
        let document =
          source.document ||
          (await PDFDocument.load(await source.file.arrayBuffer()));
        if (source.hasForms || document.getForm().getFields().length) {
          // Work on a fresh copy so flattening never mutates the source or undo history.
          document = await PDFDocument.load(await document.save());
          document.getForm().flatten({ updateFieldAppearances: false });
        }
        const instances = pages.filter((item) => item.sourceId === source.id);
        if (
          instances.some(
            (item) =>
              !Number.isInteger(item.pageIndex) ||
              item.pageIndex < 0 ||
              item.pageIndex >= document.getPageCount()
          )
        )
          throw new Error('Invalid source page number.');
        // Copy a source's resources once, so shared fonts/images aren't embedded
        // again for every page. Duplicate page leaves still need independent
        // dictionaries so rotation on one instance cannot affect another.
        const indices = [...new Set(instances.map((item) => item.pageIndex))];
        const templates = await output.copyPages(document, indices);
        const byIndex = new Map(
          indices.map((sourceIndex, i) => [sourceIndex, templates[i]])
        );
        const used = new Set<number>();
        for (const instance of instances) {
          let copy = byIndex.get(instance.pageIndex)!;
          if (used.has(instance.pageIndex)) {
            const node = copy.node.clone(output.context);
            copy = PDFPage.of(node, output.context.register(node), output);
          }
          used.add(instance.pageIndex);
          copies.set(instance.id, copy);
        }
        prepared.add(source.id);
        bookmarks.push({ title: source.name, index });
      }
      check();
      const copy = copies.get(page.id)!;
      copy.setRotation(
        degrees((copy.getRotation().angle + page.rotation) % 360)
      );
      output.addPage(copy);
    }
    options.onProgress?.(index + 1, pages.length);
    if (index % 8 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  check();
  if (options.bookmarks) fileBookmarks(output, bookmarks);
  const bytes = await output.save();
  check();
  const name =
    (options.filename?.trim() || 'merged.pdf')
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\.pdf$/i, '') + '.pdf';
  return new File([bytes as BlobPart], name, { type: 'application/pdf' });
}
