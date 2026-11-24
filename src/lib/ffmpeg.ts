import { FFmpeg } from '@ffmpeg/ffmpeg';
import coreAsset from '@ffmpeg/core?url';
import wasmAsset from '@ffmpeg/core/wasm?url';

export function loadFFmpeg(ffmpeg: FFmpeg) {
  return ffmpeg.load({
    coreURL: new URL(coreAsset, location.href).href,
    wasmURL: new URL(wasmAsset, location.href).href
  });
}

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

type FFmpegTaskContext = {
  ffmpeg: FFmpeg;
  tempFile: (extension: string) => string;
};

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) {
    return ffmpegInstance;
  }

  if (!loadingPromise) {
    loadingPromise = (async () => {
      const ffmpeg = new FFmpeg();

      await loadFFmpeg(ffmpeg);

      ffmpegInstance = ffmpeg;

      return ffmpeg;
    })();
  }

  try {
    return await loadingPromise;
  } finally {
    loadingPromise = null;
  }
}

/**
 * Destroy the current FFmpeg instance.
 *
 * Normally not needed because the instance is reused.
 * Use only after worker crashes or when explicitly freeing memory.
 */
export function resetFFmpeg(): void {
  ffmpegInstance?.terminate();

  ffmpegInstance = null;
  loadingPromise = null;
}

// FFmpeg worker is not safe for concurrent operations.
let taskQueue: Promise<unknown> = Promise.resolve();

export async function runFFmpegTask<T>(
  task: (context: FFmpegTaskContext) => Promise<T>
): Promise<T> {
  const ffmpeg = await getFFmpeg();

  const run = taskQueue
    .catch(() => {})
    .then(async () => {
      const tempFiles = new Set<string>();

      const tempFile = (extension: string) => {
        const filename = `${crypto.randomUUID()}${extension}`;

        tempFiles.add(filename);

        return filename;
      };

      try {
        return await task({
          ffmpeg,
          tempFile
        });
      } finally {
        await Promise.all(
          [...tempFiles].map((file) => ffmpeg.deleteFile(file).catch(() => {}))
        );
      }
    });

  taskQueue = run.catch(() => {});

  return run;
}
