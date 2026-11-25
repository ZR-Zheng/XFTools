import JSZip from 'jszip';
import { canvasToBlob } from '@utils/image';
import { parsePageRanges } from '../split-pdf/service';
import type { PdfJob } from '../shared/task';
import { withPdfDocument } from '../shared/document';

export async function renderPdfPages(
  file: File,
  ranges: string,
  scale: number,
  job: PdfJob = {},
  {
    format = 'png',
    quality,
    maxBytes = Infinity,
    rotation = 0
  }: {
    format?: 'png' | 'jpg';
    quality?: number;
    maxBytes?: number;
    rotation?: number;
  } = {}
): Promise<File[]> {
  return withPdfDocument(file, job.signal, async (document) => {
    const pages = parsePageRanges(ranges, document.numPages);
    if (!pages.length) throw new Error('请选择有效的 PDF 页码。');
    const files: File[] = [];
    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
    let size = 0;

    for (const [index, number] of pages.entries()) {
      job.signal?.throwIfAborted();
      const page = await document.getPage(number);
      const viewport = page.getViewport({
        scale,
        rotation: (page.rotate + rotation) % 360
      });
      const canvas = window.document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('无法创建图片画布。');

      let render: ReturnType<typeof page.render> | undefined;
      const cancel = () => render?.cancel();
      try {
        if (
          Math.max(viewport.width, viewport.height) > 4096 ||
          viewport.width * viewport.height > 16_000_000
        )
          throw new Error('页面超过可用的图片尺寸，请降低渲染倍率。');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        job.signal?.throwIfAborted();
        render = page.render({ canvas, canvasContext: context, viewport });
        job.signal?.addEventListener('abort', cancel, { once: true });
        await render.promise;
        const blob = await canvasToBlob(canvas, mimeType, quality);
        size += blob.size;
        if (size > maxBytes)
          throw new Error('页面图片过大，请选择小体积预设或缩小页码范围。');
        const name = `page-${number}.${format}`;
        files.push(new File([blob], name, { type: mimeType }));
        job.onProgress?.(index + 1, pages.length);
      } finally {
        job.signal?.removeEventListener('abort', cancel);
        page.cleanup();
        canvas.width = canvas.height = 0;
      }
    }

    return files;
  });
}

export async function convertPdfToPngImages(
  file: File,
  ranges: string,
  scale: number,
  job: PdfJob = {}
): Promise<{ files: File[]; zip: File }> {
  const files = await renderPdfPages(file, ranges, scale, job);
  const zip = new JSZip();
  for (const page of files) {
    job.signal?.throwIfAborted();
    zip.file(page.name, await page.arrayBuffer());
  }
  const bundled = await zip.generateAsync({ type: 'arraybuffer' });
  job.signal?.throwIfAborted();
  return {
    files,
    zip: new File([bundled], file.name.replace(/\.pdf$/i, '') + '-pages.zip', {
      type: 'application/zip'
    })
  };
}
