import type { PdfJob } from '../shared/task';
import type { CompressionOptions } from './types';

export type CompressionRequest = { file: File; options: CompressionOptions };
export type CompressionMessage =
  | { type: 'progress'; done: number; total: number }
  | { type: 'result'; file: File }
  | { type: 'error'; message: string };

export async function compressPdf(
  file: File,
  options: CompressionOptions,
  job: PdfJob = {}
) {
  job.signal?.throwIfAborted();
  if (
    typeof Worker !== 'function' ||
    typeof OffscreenCanvas !== 'function' ||
    typeof OffscreenCanvas.prototype.convertToBlob !== 'function' ||
    typeof createImageBitmap !== 'function'
  ) {
    const { optimizePdf } = await import('./optimize-pdf');
    return optimizePdf(file, options, job);
  }

  const worker = new Worker(
    new URL('./compression.worker.ts', import.meta.url),
    { type: 'module' }
  );
  let abort: (() => void) | undefined;
  try {
    return await new Promise<File>((resolve, reject) => {
      abort = () => reject(job.signal?.reason);
      job.signal?.addEventListener('abort', abort, { once: true });
      worker.onmessage = ({ data }: MessageEvent<CompressionMessage>) => {
        if (data.type === 'progress') job.onProgress?.(data.done, data.total);
        else if (data.type === 'result') resolve(data.file);
        else reject(new Error(data.message));
      };
      worker.onerror = (event) =>
        reject(new Error(event.message || '无法启动 PDF 压缩。'));
      worker.onmessageerror = () =>
        reject(new Error('无法读取 PDF 压缩结果。'));
      worker.postMessage({ file, options } satisfies CompressionRequest);
    });
  } finally {
    if (abort) job.signal?.removeEventListener('abort', abort);
    worker.terminate();
  }
}
