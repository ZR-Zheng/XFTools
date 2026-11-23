import { describe, expect, it } from 'vitest';
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  StandardFonts,
  degrees
} from 'pdf-lib';
import {
  duplicatePages,
  groupBySources,
  movePages,
  movePagesRelative,
  rotatePages,
  sourcePages
} from './page-plan';
import type { PdfAsset } from './page-plan';
import { exportPagePlan } from './export-page-plan';

async function fixture(
  id: string,
  widths: number[],
  forms = false
): Promise<PdfAsset> {
  const document = await PDFDocument.create();
  widths.forEach((width) => document.addPage([width, 300]));
  if (forms) {
    const field = document.getForm().createTextField('name');
    field.setText('XFTools');
    field.addToPage(document.getPage(0));
  }
  const bytes = await document.save();
  return {
    id,
    name: `${id}.pdf`,
    document,
    file: new File([bytes as BlobPart], `${id}.pdf`, {
      type: 'application/pdf'
    }),
    pageCount: widths.length,
    sizes: document
      .getPages()
      .map((page) => ({ ...page.getSize(), rotation: 0 })),
    hasForms: forms
  };
}
describe('PDF page plan', () => {
  it('moves selected groups without changing their internal order, including edges', () => {
    const pages = sourcePages('a', 5),
      ids = new Set([pages[1].id, pages[2].id]);
    expect(movePages(pages, ids, -1).map((p) => p.pageIndex)).toEqual([
      1, 2, 0, 3, 4
    ]);
    expect(movePages(pages, ids, 1).map((p) => p.pageIndex)).toEqual([
      0, 3, 1, 2, 4
    ]);
    expect(movePages([], ids, -1)).toEqual([]);
    expect(movePages([pages[0]], ids, 1)).toEqual([pages[0]]);
    expect(
      movePagesRelative(pages, ids, pages[4].id).map((p) => p.pageIndex)
    ).toEqual([0, 3, 1, 2, 4]);
    expect(movePagesRelative(pages, ids, pages[1].id)).toBe(pages);
    expect(
      movePagesRelative(pages, ids, pages[4].id, 'after').map(
        (p) => p.pageIndex
      )
    ).toEqual([0, 3, 4, 1, 2]);
  });
  it('rotates and duplicates immutable instances, and groups sources stably', () => {
    const pages = [...sourcePages('a', 2), ...sourcePages('b', 1)];
    const ids = new Set([pages[0].id]);
    const rotated = rotatePages(pages, ids);
    expect(rotated[0].rotation).toBe(90);
    expect(pages[0].rotation).toBe(0);
    const copied = duplicatePages(rotated, ids);
    expect(copied).toHaveLength(4);
    expect(copied[1].id).not.toBe(copied[0].id);
    expect(copied[1].rotation).toBe(90);
    expect(
      groupBySources(copied, [{ id: 'b' }, { id: 'a' }]).map((p) => p.sourceId)
    ).toEqual(['b', 'a', 'a', 'a']);
  });
  it('exports the exact interleaved plan, rotations, duplicates, blanks and file bookmarks', async () => {
    const a = await fixture('a', [100, 200]),
      b = await fixture('b', [400]);
    a.document!.getPage(1).setRotation(degrees(90));
    const ap = sourcePages(a.id, 2),
      bp = sourcePages(b.id, 1);
    const plan = [
      bp[0],
      { ...ap[1], rotation: 90 as const },
      ap[0],
      { ...ap[0], id: 'duplicate' },
      { id: 'blank', sourceId: null, pageIndex: 0, rotation: 0 as const }
    ];
    const file = await exportPagePlan([a, b], plan, {
      filename: 'report',
      bookmarks: true
    });
    const result = await PDFDocument.load(await file.arrayBuffer());
    expect(file.name).toBe('report.pdf');
    expect(result.getPages().map((page) => page.getWidth())).toEqual([
      400, 200, 100, 100, 595.28
    ]);
    expect(result.getPage(1).getRotation().angle).toBe(180);
    const outline = result.catalog.lookup(PDFName.of('Outlines'), PDFDict);
    const first = outline.lookup(PDFName.of('First'), PDFDict);
    const destination = first.lookup(PDFName.of('Dest'), PDFArray);
    expect(destination.get(0)).toEqual(result.getPage(0).ref);
    expect(outline.lookup(PDFName.of('Count'))?.toString()).toBe('2');
  });
  it('flattens forms on a copy and retains the source for undo and repeated exports', async () => {
    const source = await fixture('forms', [100], true);
    for (let i = 0; i < 2; i++) {
      const result = await PDFDocument.load(
        await (
          await exportPagePlan([source], sourcePages(source.id, 1))
        ).arrayBuffer()
      );
      expect(result.getForm().getFields()).toHaveLength(0);
      expect(result.getPage(0).node.Contents()).toBeDefined();
      expect(source.document!.getForm().getTextField('name').getText()).toBe(
        'XFTools'
      );
    }
  });
  it('shares copied font resources while keeping duplicate rotations independent', async () => {
    const source = await fixture('font', [100, 200]);
    const font = await source.document!.embedFont(StandardFonts.Helvetica);
    source
      .document!.getPages()
      .forEach((page) => page.drawText('XFTools', { font }));
    const pages = sourcePages(source.id, 2);
    const plan = [
      { ...pages[0], rotation: 90 as const },
      pages[1],
      { ...pages[0], id: 'duplicate' }
    ];
    const result = await PDFDocument.load(
      await (await exportPagePlan([source], plan)).arrayBuffer()
    );
    expect(result.getPages().map((page) => page.getRotation().angle)).toEqual([
      90, 0, 0
    ]);
    const fonts = result
      .getPages()
      .map((page) =>
        [
          ...page.node
            .Resources()!
            .lookup(PDFName.of('Font'), PDFDict)
            .asMap()
            .values()
        ][0].toString()
      );
    expect(new Set(fonts).size).toBe(1);
  });
  it('rejects missing pages and cancellation instead of returning partial documents', async () => {
    const source = await fixture('a', [100]),
      pages = sourcePages('a', 2);
    await expect(exportPagePlan([source], pages)).rejects.toThrow(
      'Invalid source page'
    );
    await expect(exportPagePlan([], [pages[0]])).rejects.toThrow('missing');
    await expect(exportPagePlan([source], [])).rejects.toThrow('at least');
    const controller = new AbortController();
    await expect(
      exportPagePlan([source], [pages[0]], {
        signal: controller.signal,
        onProgress: () => controller.abort()
      })
    ).rejects.toThrow();
  });
});
