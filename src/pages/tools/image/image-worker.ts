import type { ImageJob } from './image-job';

export type ImageWorkerReply<T> =
  | { type: 'progress'; message: string; progress?: number }
  | { type: 'ready'; result: T }
  | { type: 'error'; message: string };

export async function runImageWorker<T>(
  worker: Worker,
  input: unknown,
  { signal, report }: ImageJob,
  timeoutMs?: number
): Promise<T> {
  let abort: (() => void) | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    signal?.throwIfAborted();
    return await new Promise<T>((resolve, reject) => {
      abort = () => reject(signal?.reason);
      signal?.addEventListener('abort', abort, { once: true });
      if (timeoutMs)
        timeout = setTimeout(
          () => reject(new Error('图片处理超时。')),
          timeoutMs
        );
      worker.onmessage = ({ data }: MessageEvent<ImageWorkerReply<T>>) => {
        if (data.type === 'ready') resolve(data.result);
        else if (data.type === 'error') reject(new Error(data.message));
        else report?.(data.message, data.progress);
      };
      worker.onerror = (event) =>
        reject(new Error(event.message || '无法加载图片处理工具。'));
      worker.onmessageerror = () => reject(new Error('无法读取图片处理结果。'));
      worker.postMessage(input);
    });
  } finally {
    worker.terminate();
    if (abort) signal?.removeEventListener('abort', abort);
    clearTimeout(timeout);
  }
}
