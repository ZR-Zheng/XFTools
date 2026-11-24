import { InitialValuesType, units } from './types';
import { PDFDocument, PageSizes } from 'pdf-lib';
import type { ImageJob } from '../../image-job';

export function planImagePages(
  { width, height }: { width: number; height: number },
  values: InitialValuesType
) {
  const [pageWidth, pageHeight] = PageSizes[values.pageFormat];
  const ptPerOneSquare = toPts(values.unitsPerOneSquare, values.unitKind);
  const pxPerPt =
    values.pxPerSquareQuantity / (ptPerOneSquare * values.squareQuantity);
  const paddingInPts = toPts(values.padding, values.unitKind);
  const pageWidthWithPadding = pageWidth - 2 * paddingInPts;
  const pageHeightWithPadding = pageHeight - 2 * paddingInPts;

  const tileWidth = Math.round(pageWidthWithPadding * pxPerPt);
  const tileHeight = Math.round(pageHeightWithPadding * pxPerPt);
  if (
    !Number.isSafeInteger(tileWidth) ||
    !Number.isSafeInteger(tileHeight) ||
    tileWidth < 1 ||
    tileHeight < 1 ||
    !(pxPerPt > 0) ||
    !(paddingInPts >= 0) ||
    !(pageWidthWithPadding > 0) ||
    !(pageHeightWithPadding > 0)
  )
    throw new Error('纸张边距或打印比例无效。');
  const columns = Math.ceil(width / tileWidth);
  const rows = Math.ceil(height / tileHeight);
  return {
    pageWidth,
    pageHeight,
    paddingInPts,
    pageWidthWithPadding,
    pageHeightWithPadding,
    tileWidth,
    tileHeight,
    columns,
    rows
  };
}

export async function splitImagesToPDF(
  input: File,
  values: InitialValuesType,
  { signal, report }: ImageJob = {}
): Promise<File> {
  const image = await loadImage(input);
  signal?.throwIfAborted();
  const plan = planImagePages(image, values);
  const pdfDoc = await PDFDocument.create();
  const canvas = document.createElement('canvas');
  try {
    // Keep edge tiles page-sized so every page uses the same print scale.
    canvas.width = plan.tileWidth;
    canvas.height = plan.tileHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建分页画布。');
    const total = plan.rows * plan.columns;
    for (let y = 0; y < plan.rows; y++) {
      for (let x = 0; x < plan.columns; x++) {
        signal?.throwIfAborted();
        const left = x * plan.tileWidth;
        const top = y * plan.tileHeight;
        const width = Math.min(plan.tileWidth, image.width - left);
        const height = Math.min(plan.tileHeight, image.height - top);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, left, top, width, height, 0, 0, width, height);
        const tile = await canvasToFile(canvas, 'tile.png');
        const img = await pdfDoc.embedPng(await tile.arrayBuffer());
        signal?.throwIfAborted();
        const page = pdfDoc.addPage([plan.pageWidth, plan.pageHeight]);
        page.drawImage(img, {
          x: plan.paddingInPts,
          y: plan.paddingInPts,
          width: plan.pageWidthWithPadding,
          height: plan.pageHeightWithPadding
        });
        const done = y * plan.columns + x + 1;
        report?.(`生成第 ${done} / ${total} 页`, done / total);
      }
    }
  } finally {
    canvas.width = canvas.height = 0;
  }

  const pdfBytes = await pdfDoc.save();
  signal?.throwIfAborted();

  return new File(
    [pdfBytes as BlobPart],
    input.name.replace(/\.([^.]+)?$/i, `-${Date.now()}.pdf`),
    { type: 'application/pdf' }
  );
}

export function loadImage(input: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(input);
    img.src = url;
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
  });
}

function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(new File([blob], name, { type: 'image/png' }));
      } else {
        reject(new Error('Failed to create blob'));
      }
    }, 'image/png');
  });
}

export function toPts(number: number, units: units): number {
  switch (units) {
    case 'pt':
      return number;
    case 'mm':
      return (number * 72) / 25.4;
    case 'in':
      return number * 72;
  }
}

export function fromPts(number: number, units: units): number {
  switch (units) {
    case 'pt':
      return number;
    case 'mm':
      return (number * 25.4) / 72;
    case 'in':
      return number / 72;
  }
}
