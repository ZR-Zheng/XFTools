import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy
} from 'pdfjs-dist';
import type { DocumentInitParameters } from 'pdfjs-dist/types/src/display/api';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import jpeg2000Decoder from 'pdfjs-dist/wasm/openjpeg.wasm?url';
import { parsePageRanges } from '../split-pdf/service';
import type { PdfJob } from './task';

GlobalWorkerOptions.workerSrc = pdfjsWorker;

class PdfCodecData {
  async fetch({ kind, filename }: { kind: string; filename: string }) {
    if (kind !== 'wasmUrl' || filename !== 'openjpeg.wasm')
      throw new Error('无法加载 PDF 资源。');
    const response = await fetch(jpeg2000Decoder);
    if (!response.ok) throw new Error('无法加载 JPEG 2000 解码器。');
    return new Uint8Array(await response.arrayBuffer());
  }
}

export function openPdfDocument(settings: DocumentInitParameters) {
  return getDocument({
    ...settings,
    useWorkerFetch: false,
    BinaryDataFactory: PdfCodecData
  });
}

export async function withPdfDocument<T>(
  file: File,
  signal: AbortSignal | undefined,
  run: (document: PDFDocumentProxy) => Promise<T>
) {
  signal?.throwIfAborted();
  const data = await file.arrayBuffer();
  signal?.throwIfAborted();
  const task = openPdfDocument({ data });
  let closing: Promise<void> | undefined;
  const close = () => (closing ??= task.destroy());
  const cancel = () => void close().catch(() => {});
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    return await run(await task.promise);
  } finally {
    signal?.removeEventListener('abort', cancel);
    await close();
  }
}

export async function extractPdfText(file: File, ranges: string, job: PdfJob) {
  return withPdfDocument(file, job.signal, async (document) => {
    const pages = parsePageRanges(ranges, document.numPages);
    if (!pages.length) throw new Error('请选择有效的 PDF 页码。');
    const texts: string[] = [];
    let length = 0;
    for (const [index, number] of pages.entries()) {
      job.signal?.throwIfAborted();
      const page = await document.getPage(number);
      try {
        const content = await page.getTextContent();
        const text = content.items
          .map((item) =>
            'str' in item ? item.str + (item.hasEOL ? '\n' : '') : ''
          )
          .join('');
        length += text.length;
        if (length > 8_000_000)
          throw new Error('提取的正文过长，请缩小 PDF 页码范围。');
        texts.push(text);
      } finally {
        page.cleanup();
      }
      job.onProgress?.(index + 1, pages.length);
    }
    if (!texts.some((text) => text.trim()))
      throw new Error('所选页面没有可提取的文字。扫描件需要先做 OCR。');
    return texts;
  });
}
