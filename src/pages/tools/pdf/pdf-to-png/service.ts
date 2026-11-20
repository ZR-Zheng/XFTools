import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import JSZip from 'jszip';
import { canvasToBlob } from '@utils/image';
import { parsePageRanges } from '../split-pdf/service';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function convertPdfToPngImages(
  file: File,
  ranges: string,
  scale: number
): Promise<{ files: File[]; zip: File }> {
  const task = pdfjsLib.getDocument({ data: await file.arrayBuffer() });
  try {
    const document = await task.promise;
    const pages = parsePageRanges(ranges, document.numPages);
    if (!pages.length) throw new Error('请选择有效的 PDF 页码。');
    const files: File[] = [];
    const zip = new JSZip();

    for (const number of pages) {
      const page = await document.getPage(number);
      const viewport = page.getViewport({ scale });
      const canvas = window.document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('无法创建图片画布。');

      try {
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        const blob = await canvasToBlob(canvas);
        const name = 'page-' + number + '.png';
        files.push(new File([blob], name, { type: 'image/png' }));
        zip.file(name, new Uint8Array(await blob.arrayBuffer()));
      } finally {
        page.cleanup();
        canvas.width = canvas.height = 0;
      }
    }

    return {
      files,
      zip: new File(
        [await zip.generateAsync({ type: 'arraybuffer' })],
        file.name.replace(/\.pdf$/i, '') + '-pages.zip',
        { type: 'application/zip' }
      )
    };
  } finally {
    await task.destroy();
  }
}
