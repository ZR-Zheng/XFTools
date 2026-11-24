import type { ImageJob } from '../image-job';
import { runImageWorker } from '../image-worker';
import type { BackgroundInput } from './background.worker';

export type BackgroundMode = 'auto' | 'color';
export type BackgroundResult = {
  file: File;
  method: 'ai' | 'color' | 'fallback';
};

async function runEngine({ file, mode }: BackgroundInput, job: ImageJob) {
  const { signal } = job;
  signal?.throwIfAborted();
  if (
    typeof Worker !== 'function' ||
    typeof OffscreenCanvas !== 'function' ||
    typeof OffscreenCanvas.prototype.convertToBlob !== 'function' ||
    typeof createImageBitmap !== 'function'
  ) {
    if (mode === 'color') {
      const { removeSolidBackground } =
        await import('../generic/remove-background/color-background');
      return removeSolidBackground(file, job);
    }
    const { removeImageBackground } =
      await import('../generic/remove-background/service');
    return removeImageBackground(file, job);
  }
  return runImageWorker<File>(
    new Worker(new URL('./background.worker.ts', import.meta.url), {
      type: 'module'
    }),
    { file, mode } satisfies BackgroundInput,
    job,
    mode === 'ai' ? 90_000 : undefined
  );
}

export async function runBackgroundTask(
  file: File,
  job: ImageJob,
  mode: BackgroundMode
): Promise<BackgroundResult> {
  if (mode === 'color')
    return { file: await runEngine({ file, mode }, job), method: 'color' };

  try {
    return { file: await runEngine({ file, mode: 'ai' }, job), method: 'ai' };
  } catch {
    job.signal?.throwIfAborted();
    try {
      const fallback = await runEngine({ file, mode: 'color' }, job);
      return { file: fallback, method: 'fallback' };
    } catch (failure) {
      job.signal?.throwIfAborted();
      const reason =
        failure instanceof Error ? failure.message : '纯色去底失败。';
      throw new Error(`AI 抠图暂不可用，${reason}`, { cause: failure });
    }
  }
}
