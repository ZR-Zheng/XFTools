import {
  degrees,
  PDFDocument,
  PDFHexString,
  PDFPage,
  PDFRadioGroup,
  PDFString,
  StandardFonts,
  rgb
} from 'pdf-lib';
import { canvasToBlob } from '@utils/image';
import {
  editBoxToPdf,
  isFormEdit,
  pageCropBox,
  type Box,
  type PageEdit
} from '../shared/page-edits';
import type { PdfPageInstance } from '../shared/page-plan';

const pdfNumber = (value: number) => value.toFixed(5);
const numbers = (values: number[]) => values.map(pdfNumber).join(' ');
const colorComponents = (color: string) =>
  [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16) / 255);

function appearance(
  document: PDFDocument,
  box: Box,
  content: string,
  resources = document.context.obj({})
) {
  const { context } = document;
  return context.register(
    context.flateStream(content, {
      Type: 'XObject',
      Subtype: 'Form',
      BBox: [0, 0, box.width, box.height],
      Resources: resources
    })
  );
}

async function textAppearance(
  document: PDFDocument,
  box: Box,
  edit: PageEdit,
  field = false
) {
  const sideways = edit.angle % 180 !== 0;
  const width = sideways ? box.height : box.width;
  const height = sideways ? box.width : box.height;
  const scale = Math.min(2, 1800 / Math.max(width, height));
  const canvas = window.document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width * scale));
  canvas.height = Math.max(1, Math.ceil(height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法绘制批注或表单外观。');
  try {
    context.scale(scale, scale);
    if (field) {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.strokeStyle = '#277667';
      context.strokeRect(
        0.5,
        0.5,
        Math.max(0, width - 1),
        Math.max(0, height - 1)
      );
    }
    const fontSize = Math.min(12, Math.max(5, height - 4));
    const lineHeight = fontSize * 1.25;
    context.fillStyle = field ? '#142e2b' : edit.color;
    context.font = `${fontSize}px system-ui, sans-serif`;
    context.textBaseline = 'top';
    let line = '';
    let top = 2;
    for (const character of edit.text) {
      if (
        character === '\n' ||
        (line && context.measureText(line + character).width > width - 6)
      ) {
        context.fillText(line, 3, top);
        line = '';
        top += lineHeight;
      }
      if (top >= height) break;
      if (character !== '\n') line += character;
    }
    if (line && top < height) context.fillText(line, 3, top);
    const blob = await canvasToBlob(canvas);
    const image = await document.embedPng(await blob.arrayBuffer());
    const w = box.width;
    const h = box.height;
    const matrix =
      edit.angle === 90
        ? [0, h, -w, 0, w, 0]
        : edit.angle === 180
          ? [-w, 0, 0, -h, w, h]
          : edit.angle === 270
            ? [0, -h, w, 0, 0, h]
            : [w, 0, 0, h, 0, 0];
    return appearance(
      document,
      box,
      `q ${numbers(matrix)} cm /TextImage Do Q`,
      document.context.obj({ XObject: { TextImage: image.ref } })
    );
  } finally {
    canvas.width = canvas.height = 0;
  }
}

async function writeAnnotation(
  page: PDFPage,
  edit: PageEdit,
  instanceId: string
) {
  const { doc } = page;
  const crop = pageCropBox(page);
  const box = editBoxToPdf(edit.box, crop);
  const color = colorComponents(edit.color);
  let extra: object;
  let normal;
  let subtype = 'Text';
  if (edit.kind === 'highlight') {
    subtype = 'Highlight';
    const right = box.x + box.width;
    const top = box.y + box.height;
    // Common PDF viewers consume text markup points in top-left, top-right, bottom-left, bottom-right order.
    extra = {
      QuadPoints: [box.x, top, right, top, box.x, box.y, right, box.y],
      CA: 0.35
    };
    normal = appearance(
      doc,
      box,
      `/Marker gs ${numbers(color)} rg 0 0 ${numbers([box.width, box.height])} re f`,
      doc.context.obj({
        ExtGState: { Marker: { Type: 'ExtGState', ca: 0.35, BM: 'Multiply' } }
      })
    );
  } else if (edit.kind === 'ink') {
    subtype = 'Ink';
    const points = (edit.points ?? []).map(({ x, y }) => [
      crop.x + x * crop.width,
      crop.y + (1 - y) * crop.height
    ]);
    if (points.length < 2) return;
    const lineWidth = 2;
    box.x -= lineWidth;
    box.y -= lineWidth;
    box.width += 2 * lineWidth;
    box.height += 2 * lineWidth;
    extra = { InkList: [points.flat()], BS: { W: lineWidth, S: 'S' } };
    const path = points
      .map(
        ([x, y], index) =>
          `${numbers([x - box.x, y - box.y])} ${index ? 'l' : 'm'}`
      )
      .join('\n');
    normal = appearance(doc, box, `2 w 1 J 1 j ${numbers(color)} RG ${path} S`);
  } else if (edit.kind === 'freeText' || edit.kind === 'label') {
    subtype = 'FreeText';
    extra = {
      DA: PDFString.of(`${numbers(color)} rg /Helv 12 Tf`),
      Q: 0,
      Border: [0, 0, 0]
    };
    normal = await textAppearance(doc, box, edit);
  } else {
    extra = { Name: 'Note', Open: false };
    normal = appearance(
      doc,
      box,
      `q ${numbers([box.width, 0, 0, box.height, 0, 0])} cm ${numbers(color)} rg .04 .04 .92 .92 re f .23 .17 .06 RG .05 w .25 .69 m .75 .69 l .25 .51 m .75 .51 l .25 .33 m .60 .33 l S Q`
    );
  }
  const annotation = doc.context.obj({
    Type: 'Annot',
    Subtype: subtype,
    P: page.ref,
    Rect: [box.x, box.y, box.x + box.width, box.y + box.height],
    NM: PDFHexString.fromText(`${instanceId}-${edit.id}`),
    Contents: PDFHexString.fromText(edit.text),
    C: color,
    F: 4,
    AP: { N: normal },
    ...extra
  });
  page.node.addAnnot(doc.context.register(annotation));
}

export async function writePageEdits(
  document: PDFDocument,
  pages: readonly PdfPageInstance[],
  signal?: AbortSignal
) {
  const outputPages = document.getPages();
  const form = document.getForm();
  const names = new Set(form.getFields().map((field) => field.getName()));
  const radioGroups = new Map<string, PDFRadioGroup>();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const [index, instance] of pages.entries()) {
    const page = outputPages[index];
    for (const edit of instance.edits ?? []) {
      signal?.throwIfAborted();
      if (!isFormEdit(edit.kind) || edit.kind === 'label') {
        await writeAnnotation(page, edit, instance.id);
        continue;
      }
      const box = editBoxToPdf(edit.box, pageCropBox(page));
      const angle = edit.angle;
      const sideways = angle % 180 !== 0;
      const options = {
        x: box.x + (angle === 90 || angle === 180 ? box.width - 0.5 : 0.5),
        y: box.y + (angle === 180 || angle === 270 ? box.height - 0.5 : 0.5),
        width: Math.max(0.01, (sideways ? box.height : box.width) - 1),
        height: Math.max(0.01, (sideways ? box.width : box.height) - 1),
        rotate: degrees(angle),
        borderWidth: 1,
        borderColor: rgb(0.15, 0.46, 0.4),
        font
      };
      const base =
        Array.from(edit.name.trim(), (character) =>
          character === '.' || character.charCodeAt(0) < 32 ? '_' : character
        ).join('') || `field_${edit.id.slice(0, 8)}`;
      let name = base;
      let suffix = 2;
      while (
        names.has(name) ||
        [...names].some((existing) => existing.startsWith(`${name}.`))
      )
        name = `${base}_${suffix++}`;
      if (edit.kind === 'radio') {
        let group = radioGroups.get(base);
        if (!group) {
          group = form.createRadioGroup(name);
          names.add(name);
          radioGroups.set(base, group);
        }
        const option =
          edit.text.trim() || `option_${group.getOptions().length + 1}`;
        group.addOptionToPage(option, page, options);
        if (edit.checked) group.select(option);
        if (edit.required) group.enableRequired();
        continue;
      }
      names.add(name);
      if (edit.kind === 'checkbox') {
        const field = form.createCheckBox(name);
        field.addToPage(page, options);
        if (edit.checked) field.check();
        if (edit.required) field.enableRequired();
      } else {
        const field = form.createTextField(name);
        if (edit.kind === 'textarea') field.enableMultiline();
        if (edit.required) field.enableRequired();
        let unicode = false;
        try {
          font.encodeText(edit.text.replace(/\r?\n/g, ' '));
        } catch {
          unicode = true;
        }
        if (!unicode) field.setText(edit.text);
        field.addToPage(page, options);
        if (unicode) {
          field.setText(edit.text);
          field.acroField
            .getWidgets()[0]
            .setNormalAppearance(
              await textAppearance(document, box, edit, true)
            );
          form.markFieldAsClean(field.ref);
        }
      }
    }
  }
  signal?.throwIfAborted();
}
