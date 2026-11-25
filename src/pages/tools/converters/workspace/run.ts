import { settingsError, type Settings } from './formats';

export async function runConversion(
  file: File,
  settings: Settings,
  signal: AbortSignal,
  onProgress: (progress: number, waiting?: boolean) => void
) {
  signal.throwIfAborted();
  const error = settingsError(settings);
  if (error) throw new Error(error);
  switch (settings.group) {
    case 'image': {
      const { convertImage } = await import('./images');
      return convertImage(file, settings, signal);
    }
    case 'document': {
      const { convertDocument } = await import('./documents');
      return convertDocument(file, settings, signal, onProgress);
    }
    default: {
      const { convertMedia } = await import('./media');
      return convertMedia(file, settings, signal, onProgress);
    }
  }
}
