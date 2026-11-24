import type { Asset } from './timeline';
import { isAcceptedFile } from 'hooks/useFileDrop';
import { readGif } from './gif-preview';

export const videoTypes = ['video/*', '.mp4', '.webm', '.mov', '.m4v', '.ogv'];
export const imageTypes = [
  'image/*',
  '.gif',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.bmp',
  '.avif'
];
export const audioTypes = [
  'audio/*',
  '.mp3',
  '.wav',
  '.m4a',
  '.aac',
  '.flac',
  '.ogg',
  '.opus'
];

export function assetKind(file: File): Asset['kind'] | undefined {
  if (isAcceptedFile(file, ['image/gif', '.gif'])) return 'gif';
  if (isAcceptedFile(file, videoTypes)) return 'video';
  if (isAcceptedFile(file, imageTypes)) return 'image';
  if (isAcceptedFile(file, audioTypes)) return 'audio';
}

function thumbnailFor(
  source: CanvasImageSource,
  width: number,
  height: number
) {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 160 / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(
    source instanceof HTMLVideoElement ? 'image/jpeg' : 'image/png',
    0.75
  );
}

export async function loadStill(url: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const image = new Image();
  const cancel = () => image.removeAttribute('src');
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    image.src = url;
    await image.decode();
    signal?.throwIfAborted();
    return image;
  } finally {
    signal?.removeEventListener('abort', cancel);
  }
}

async function importVisual(
  file: File,
  kind: 'gif' | 'image',
  signal: AbortSignal
): Promise<Asset> {
  const url = URL.createObjectURL(file);
  try {
    let visual: Pick<Asset, 'width' | 'height' | 'duration' | 'thumbnail'>;
    if (kind === 'gif') {
      visual = await readGif(file, signal);
    } else {
      const image = await loadStill(url, signal);
      visual = {
        width: image.naturalWidth,
        height: image.naturalHeight,
        duration: 10,
        thumbnail: thumbnailFor(image, image.naturalWidth, image.naturalHeight)
      };
      image.removeAttribute('src');
    }
    signal.throwIfAborted();
    return {
      id: crypto.randomUUID(),
      kind,
      file,
      url,
      ...visual
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export function importAsset(
  file: File,
  kind: Asset['kind'],
  signal: AbortSignal
) {
  if (kind === 'gif' || kind === 'image')
    return importVisual(file, kind, signal);
  const mediaKind = kind;
  return new Promise<Asset>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const element = document.createElement(kind);
    element.preload = 'metadata';
    element.muted = true;
    let settled = false;
    const timer = window.setTimeout(fail, 12000);

    function clear() {
      window.clearTimeout(timer);
      element.removeEventListener('loadedmetadata', loaded);
      element.removeEventListener('loadeddata', dataReady);
      element.removeEventListener('durationchange', durationReady);
      element.removeEventListener('timeupdate', durationReady);
      element.removeEventListener('seeked', complete);
      element.removeEventListener('error', fail);
      signal.removeEventListener('abort', fail);
      element.removeAttribute('src');
      element.load();
    }

    function fail() {
      if (settled) return;
      settled = true;
      clear();
      URL.revokeObjectURL(url);
      reject(new Error('无法读取 ' + file.name + '。请检查文件编码。'));
    }

    function complete() {
      if (settled) return;
      const { duration } = element;
      if (!Number.isFinite(duration) || duration <= 0) return fail();
      const video = element instanceof HTMLVideoElement ? element : undefined;
      const width = video?.videoWidth ?? 0;
      const height = video?.videoHeight ?? 0;
      if (video && (!width || !height)) return fail();
      const thumbnail =
        video && video.readyState >= 2
          ? thumbnailFor(video, width, height)
          : undefined;
      settled = true;
      clear();
      resolve({
        id: crypto.randomUUID(),
        kind: mediaKind,
        file,
        url,
        duration,
        width,
        height,
        thumbnail
      });
    }

    function loaded() {
      if (kind === 'audio' && Number.isFinite(element.duration)) complete();
      else if (!Number.isFinite(element.duration)) {
        // Some camera and MediaRecorder files have no duration in their header.
        element.addEventListener('durationchange', durationReady);
        element.addEventListener('timeupdate', durationReady);
        element.currentTime = Number.MAX_SAFE_INTEGER;
      }
    }

    function durationReady() {
      if (!Number.isFinite(element.duration)) return;
      element.removeEventListener('durationchange', durationReady);
      element.removeEventListener('timeupdate', durationReady);
      if (kind === 'audio') complete();
      else {
        element.addEventListener('seeked', complete, { once: true });
        element.currentTime = 0;
      }
    }

    function dataReady() {
      if (Number.isFinite(element.duration)) complete();
    }

    if (signal.aborted) return fail();
    signal.addEventListener('abort', fail, { once: true });
    element.addEventListener('loadedmetadata', loaded);
    element.addEventListener('loadeddata', dataReady);
    element.addEventListener('error', fail);
    element.preload = 'auto';
    element.src = url;
  });
}
