import {
  getDocument,
  GlobalWorkerOptions,
  ImageKind,
  OPS,
  type PDFPageProxy
} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import JSZip from 'jszip';
import { canvasToBlob } from '@utils/image';
import type { PdfJob } from '../shared/task';

GlobalWorkerOptions.workerSrc = workerUrl;

type ImageObject = {
  width: number;
  height: number;
  bitmap?: ImageBitmap;
  data?: Uint8Array | Uint8ClampedArray;
  kind?: number;
};

function imageObject(page: PDFPageProxy, id: string, signal?: AbortSignal) {
  return new Promise<ImageObject | undefined>((resolve) => {
    const finish = (image?: ImageObject) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      resolve(image);
    };
    const cancel = () => finish();
    const timer = setTimeout(cancel, 3000);
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      const objects = id.startsWith('g_') ? page.commonObjs : page.objs;
      objects.get(id, finish);
    } catch {
      finish();
    }
  });
}

async function imageBlob(image: ImageObject) {
  const { width, height, data, kind, bitmap } = image;
  if (
    width < 1 ||
    height < 1 ||
    Math.max(width, height) > 4096 ||
    width * height > 16_000_000
  )
    return;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return;
  try {
    if (bitmap) context.drawImage(bitmap, 0, 0);
    else if (data) {
      const rgba = context.createImageData(width, height);
      const pixels = rgba.data;
      if (
        kind === ImageKind.RGBA_32BPP ||
        (!kind && data.length === pixels.length)
      )
        pixels.set(data);
      else if (kind === ImageKind.RGB_24BPP) {
        for (let i = 0, j = 0; i < pixels.length; i += 4, j += 3) {
          pixels[i] = data[j];
          pixels[i + 1] = data[j + 1];
          pixels[i + 2] = data[j + 2];
          pixels[i + 3] = 255;
        }
      } else if (kind === ImageKind.GRAYSCALE_1BPP) {
        const stride = Math.ceil(width / 8);
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const shade =
              data[y * stride + (x >> 3)] & (128 >> (x & 7)) ? 255 : 0;
            pixels[i] = pixels[i + 1] = pixels[i + 2] = shade;
            pixels[i + 3] = 255;
          }
      } else return;
      context.putImageData(rgba, 0, 0);
    } else return;
    return await canvasToBlob(canvas);
  } finally {
    canvas.width = canvas.height = 0;
  }
}

export async function processPDF(input: File, job: PdfJob = {}) {
  const data = await input.arrayBuffer();
  job.signal?.throwIfAborted();
  const loading = getDocument({ data, isOffscreenCanvasSupported: false });
  const seen = new Set<string>();
  const extractedImages: File[] = [];
  try {
    const pdf = await loading.promise;
    for (let number = 1; number <= pdf.numPages; number++) {
      job.signal?.throwIfAborted();
      const page = await pdf.getPage(number);
      const { fnArray, argsArray } = await page.getOperatorList();
      let count = 0;
      for (const [index, operation] of fnArray.entries()) {
        job.signal?.throwIfAborted();
        let image: ImageObject | undefined;
        if (
          operation === OPS.paintImageXObject ||
          operation === OPS.paintImageXObjectRepeat
        ) {
          const id = argsArray[index][0] as string;
          if (seen.has(id)) continue;
          seen.add(id);
          image = await imageObject(page, id, job.signal);
        } else if (operation === OPS.paintInlineImageXObject)
          image = argsArray[index][0];
        if (!image) continue;
        const blob = await imageBlob(image);
        if (blob)
          extractedImages.push(
            new File([blob], `page_${number}_img_${++count}.png`, {
              type: 'image/png'
            })
          );
      }
      page.cleanup();
      job.onProgress?.(number, pdf.numPages);
    }
  } finally {
    await loading.destroy();
  }
  job.signal?.throwIfAborted();
  if (!extractedImages.length) return null;
  if (extractedImages.length === 1) return { extractedImages, zipFile: null };
  const zip = new JSZip();
  for (const file of extractedImages) {
    job.signal?.throwIfAborted();
    zip.file(file.name, await file.arrayBuffer());
  }
  const bytes = await zip.generateAsync({ type: 'arraybuffer' });
  job.signal?.throwIfAborted();
  return {
    extractedImages,
    zipFile: new File(
      [bytes],
      `${input.name.replace(/\.pdf$/i, '')}-images.zip`,
      { type: 'application/zip' }
    )
  };
}
