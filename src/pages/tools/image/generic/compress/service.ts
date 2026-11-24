import imageCompression from 'browser-image-compression';
import workerLibrary from 'browser-image-compression/dist/browser-image-compression.js?url';
import type { InitialValuesType } from './types';

export async function compressImage(
  file: File,
  options: InitialValuesType,
  signal?: AbortSignal
): Promise<File> {
  const compressed = await imageCompression(file, {
    maxSizeMB: options.maxFileSizeInMB,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    libURL: new URL(workerLibrary, window.location.href).href,
    preserveExif: true,
    signal,
    initialQuality: options.quality / 100
  });
  if (
    compressed.size >= file.size ||
    (file.type && compressed.type !== file.type)
  )
    return file;
  return new File([compressed], file.name, { type: compressed.type });
}
