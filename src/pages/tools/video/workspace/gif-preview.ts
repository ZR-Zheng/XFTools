import type { GifMessage, GifReply } from './gif-preview.worker';

function createWorker(file: File, thumbnail: boolean) {
  const worker = new Worker(
    new URL('./gif-preview.worker.ts', import.meta.url),
    { type: 'module' }
  );
  worker.postMessage({ type: 'open', file, thumbnail } satisfies GifMessage);
  return worker;
}

export function readGif(file: File, signal: AbortSignal) {
  return new Promise<Omit<Extract<GifReply, { type: 'ready' }>, 'type'>>(
    (resolve, reject) => {
      signal.throwIfAborted();
      const worker = createWorker(file, true);
      const abort = () => {
        close();
        reject(signal.reason);
      };
      function close() {
        window.clearTimeout(timeout);
        worker.terminate();
        signal.removeEventListener('abort', abort);
      }
      const timeout = window.setTimeout(() => {
        close();
        reject(new Error('读取 GIF 超时，请尝试较短的动图。'));
      }, 15_000);
      worker.onmessage = ({ data }: MessageEvent<GifReply>) => {
        if (data.type === 'ready') {
          close();
          const { width, height, duration, thumbnail } = data;
          resolve({ width, height, duration, thumbnail });
        } else if (data.type === 'error') {
          close();
          reject(new Error(data.message));
        }
      };
      worker.onerror = () => {
        close();
        reject(new Error('当前浏览器无法启动 GIF 解码。'));
      };
      signal.addEventListener('abort', abort, { once: true });
    }
  );
}

export function openGifPreview(
  file: File,
  onFrame: (bitmap: ImageBitmap) => void,
  onError: () => void
) {
  const worker = createWorker(file, false);
  let ready = false;
  let pending = false;
  let sent = -1;
  let wanted = 0;
  let active = true;
  function send() {
    if (!active || !ready || pending || sent === wanted) return;
    pending = true;
    sent = wanted;
    worker.postMessage({ type: 'seek', time: wanted } satisfies GifMessage);
  }
  function close() {
    active = false;
    worker.terminate();
  }
  function fail() {
    close();
    onError();
  }
  worker.onerror = fail;
  worker.onmessage = ({ data }: MessageEvent<GifReply>) => {
    if (!active) {
      if (data.type === 'frame') data.bitmap?.close();
      return;
    }
    if (data.type === 'error') return fail();
    if (data.type === 'ready') ready = true;
    else {
      pending = false;
      if (data.bitmap) onFrame(data.bitmap);
    }
    send();
  };
  return {
    seek: (time: number) => {
      wanted = time;
      send();
    },
    close
  };
}
