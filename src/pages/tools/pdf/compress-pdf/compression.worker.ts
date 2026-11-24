import { optimizePdf } from './optimize-pdf';
import type { CompressionMessage, CompressionRequest } from './service';

self.onmessage = async ({
  data: { file, options }
}: MessageEvent<CompressionRequest>) => {
  const send = (message: CompressionMessage) => self.postMessage(message);
  try {
    const result = await optimizePdf(file, options, {
      onProgress: (done, total) => send({ type: 'progress', done, total })
    });
    send({ type: 'result', file: result });
  } catch (error) {
    send({
      type: 'error',
      message: error instanceof Error ? error.message : String(error)
    });
  }
};
