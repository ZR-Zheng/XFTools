import { decodeGif } from './gif-frames';

export type GifMessage =
  | { type: 'open'; file: File; thumbnail: boolean }
  | { type: 'seek'; time: number };
export type GifReply =
  | {
      type: 'ready';
      width: number;
      height: number;
      duration: number;
      thumbnail?: string;
    }
  | { type: 'frame'; bitmap?: ImageBitmap }
  | { type: 'error'; message: string };

let gif: ReturnType<typeof decodeGif> | undefined;
let preview: OffscreenCanvas | undefined;

function fit(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return new OffscreenCanvas(
    Math.max(1, Math.round(width * scale)),
    Math.max(1, Math.round(height * scale))
  );
}

self.onmessage = async ({ data }: MessageEvent<GifMessage>) => {
  try {
    if (data.type === 'open') {
      // The parser needs the compressed GIF, while the decoded pixels stay inside this worker.
      if (data.file.size > 128 * 1024 * 1024)
        throw new Error('GIF 文件超过 128 MB，请先缩小文件。');
      gif = decodeGif(new Uint8Array(await data.file.arrayBuffer()));
      const { width, height, duration } = gif;
      let thumbnail: string | undefined;
      if (data.thumbnail) {
        const thumb = fit(width, height, 160);
        thumb
          .getContext('2d')!
          .drawImage(gif.frameAt(0)!, 0, 0, thumb.width, thumb.height);
        const blob = await thumb.convertToBlob();
        thumbnail = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
      } else preview = fit(width, height, 960);
      self.postMessage({
        type: 'ready',
        width,
        height,
        duration,
        thumbnail
      } satisfies GifReply);
    } else {
      const frame = gif?.frameAt(data.time);
      if (!frame || !preview) {
        self.postMessage({ type: 'frame' } satisfies GifReply);
        return;
      }
      const context = preview.getContext('2d')!;
      context.clearRect(0, 0, preview.width, preview.height);
      context.drawImage(frame, 0, 0, preview.width, preview.height);
      const bitmap = preview.transferToImageBitmap();
      self.postMessage({ type: 'frame', bitmap } satisfies GifReply, {
        transfer: [bitmap]
      });
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : '无法解码 GIF。'
    } satisfies GifReply);
  }
};
