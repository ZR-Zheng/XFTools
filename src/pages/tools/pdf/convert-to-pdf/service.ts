import jsPDF from 'jspdf';
import type { ImageSize, InitialValuesType } from './types';
import type { PdfJob } from '../shared/task';

const pxToMm = (px: number) => px * 0.264583;

async function readableImage(file: File) {
  if (
    /\.(heic|heif)$/i.test(file.name) ||
    /^image\/hei[cf]$/i.test(file.type)
  ) {
    const { heicTo } = await import('heic-to');
    return heicTo({ blob: file, type: 'image/jpeg' });
  }
  return file;
}

export async function buildPdf(
  files: File[],
  options: InitialValuesType,
  job: PdfJob = {}
) {
  if (!files.length) throw new Error('请选择要转换的图片。');
  const { pageType, orientation, scale } = options;
  const imageSizes: ImageSize[] = [];
  let pdf: jsPDF | undefined;
  for (const [index, file] of files.entries()) {
    job.signal?.throwIfAborted();
    const image = new Image();
    const blob = await readableImage(file).catch(() => {
      throw new Error(`无法读取图片 ${file.name}。`);
    });
    job.signal?.throwIfAborted();
    const url = URL.createObjectURL(blob);
    try {
      image.src = url;
      await image.decode().catch(() => {
        throw new Error(`无法读取图片 ${file.name}。`);
      });
      job.signal?.throwIfAborted();
      const widthPx = image.naturalWidth;
      const heightPx = image.naturalHeight;
      const widthMm = pxToMm(widthPx);
      const heightMm = pxToMm(heightPx);
      const format: 'a4' | number[] =
        pageType === 'full' ? [widthMm, heightMm] : 'a4';
      const direction =
        pageType === 'full'
          ? widthPx > heightPx
            ? 'landscape'
            : 'portrait'
          : orientation;
      if (!pdf) {
        pdf = new jsPDF({
          format,
          orientation: direction,
          unit: 'mm',
          compress: true
        });
        pdf.setDisplayMode('fullwidth');
      } else pdf.addPage(format, direction);
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const fit =
        Math.min(pageWidth / widthPx, pageHeight / heightPx) *
        (pageType === 'full' ? 1 : scale / 100);
      const width = widthPx * fit;
      const height = heightPx * fit;
      const encoding =
        blob.type === 'image/png' || /\.png$/i.test(file.name) ? 'PNG' : 'JPEG';
      pdf.addImage(
        image,
        encoding,
        (pageWidth - width) / 2,
        (pageHeight - height) / 2,
        width,
        height
      );
      imageSizes.push({ widthMm, heightMm, widthPx, heightPx });
      job.onProgress?.(index + 1, files.length);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  job.signal?.throwIfAborted();
  if (!pdf) throw new Error('没有可转换的图片。');
  const fileName =
    files.length === 1
      ? `${files[0].name.replace(/\.[^/.]+$/, '')}.pdf`
      : 'merged-images.pdf';
  return {
    pdfFile: new File([pdf.output('blob')], fileName, {
      type: 'application/pdf'
    }),
    imageSizes
  };
}
