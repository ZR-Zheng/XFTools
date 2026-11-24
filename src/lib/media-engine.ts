import { FFmpeg, FFFSType } from '@ffmpeg/ffmpeg';
import { getFileExtension } from '@utils/file';

export async function withMediaEngine<T>(
  signal: AbortSignal,
  run: (ffmpeg: FFmpeg) => Promise<T>,
  onQueue?: () => void
) {
  async function render() {
    signal.throwIfAborted();
    const ffmpeg = new FFmpeg();
    const terminate = () => ffmpeg.terminate();
    signal.addEventListener('abort', terminate, { once: true });
    try {
      return await run(ffmpeg);
    } finally {
      signal.removeEventListener('abort', terminate);
      terminate();
    }
  }
  if (!navigator.locks) return render();
  onQueue?.();
  // Share the worker budget with the audio and video workspaces.
  return navigator.locks.request('xftools-video-export', { signal }, render);
}

export async function mountMediaSources(
  ffmpeg: FFmpeg,
  files: File[],
  mountError: string
) {
  const names = files.map((file, index) => {
    const extension = getFileExtension(file.name).replace(/[^a-z0-9]/g, '');
    return `source-${index}${extension ? '.' + extension : ''}`;
  });
  await ffmpeg.createDir('/sources');
  const mounted = await ffmpeg.mount(
    FFFSType.WORKERFS,
    { blobs: files.map((file, index) => ({ name: names[index], data: file })) },
    '/sources'
  );
  if (!mounted) throw new Error(mountError);
  return names.map((name) => `/sources/${name}`);
}
