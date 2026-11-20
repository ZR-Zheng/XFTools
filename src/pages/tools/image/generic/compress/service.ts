import imageCompression from 'browser-image-compression';
import type { InitialValuesType } from './types';

export async function compressImage(
  file: File,
  options: InitialValuesType
): Promise<File> {
  const compressed = await imageCompression(file, {
    maxSizeMB: options.maxFileSizeInMB,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    preserveExif: true,
    initialQuality: options.quality / 100
  });
  if (
    compressed.size >= file.size ||
    (file.type && compressed.type !== file.type)
  )
    return file;
  return new File([compressed], file.name, { type: compressed.type });
}
