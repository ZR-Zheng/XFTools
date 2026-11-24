import { removeImageBackground } from '../generic/remove-background/service';
import { removeSolidBackground } from '../generic/remove-background/color-background';
import type { ImageWorkerReply } from '../image-worker';

export type BackgroundInput = { file: File; mode: 'ai' | 'color' };

self.onmessage = async ({ data }: MessageEvent<BackgroundInput>) => {
  const send = (reply: ImageWorkerReply<File>) => self.postMessage(reply);
  try {
    const remove =
      data.mode === 'color' ? removeSolidBackground : removeImageBackground;
    const file = await remove(data.file, {
      report: (message, progress) =>
        send({ type: 'progress', message, progress })
    });
    send({ type: 'ready', result: file });
  } catch (error) {
    send({
      type: 'error',
      message: error instanceof Error ? error.message : String(error)
    });
  }
};
