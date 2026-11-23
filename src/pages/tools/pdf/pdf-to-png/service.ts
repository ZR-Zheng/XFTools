import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import JSZip from 'jszip';
import { canvasToBlob } from '@utils/image';
import { parsePageRanges } from '../split-pdf/service';
import type { PdfJob } from '../shared/task';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function convertPdfToPngImages(
  file: File,
  ranges: string,
  scale: number,
  job: PdfJob = {}
): Promise<{ files: File[]; zip: File }> {
  const data = await file.arrayBuffer();
  job.signal?.throwIfAborted();
  const task = pdfjsLib.getDocument({ data });
  try {
    const document = await task.promise;
    const pages = parsePageRanges(ranges, document.numPages);
    if (!pages.length) throw new Error('请选择有效的 PDF 页码。');
    const files: File[] = [];
    const zip = new JSZip();

    for (const [index, number] of pages.entries()) {
      job.signal?.throwIfAborted();
      const page = await document.getPage(number);
      const viewport = page.getViewport({ scale });
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
        const blob = await canvasToBlob(canvas);
        const name = 'page-' + number + '.png';
        files.push(new File([blob], name, { type: 'image/png' }));
        zip.file(name, new Uint8Array(await blob.arrayBuffer()));
        job.onProgress?.(index + 1, pages.length);
      } finally {
        job.signal?.removeEventListener('abort', cancel);
        page.cleanup();
        canvas.width = canvas.height = 0;
      }
    }

    job.signal?.throwIfAborted();
    const bundled = await zip.generateAsync({ type: 'arraybuffer' });
    job.signal?.throwIfAborted();
    return {
      files,
      zip: new File(
        [bundled],
        file.name.replace(/\.pdf$/i, '') + '-pages.zip',
        { type: 'application/zip' }
      )
    };
  } finally {
    await task.destroy();
  }
}
