import { exportImage } from './render-image';
import type { Edit, ImageSource, Size } from './session';

export type ImageSnapshot = {
  source: ImageSource;
  edits: readonly Edit[];
  size: Size;
};

export async function snapshotFile(
  snapshot: ImageSnapshot,
  signal?: AbortSignal
) {
  signal?.throwIfAborted();
  const file = await exportImage(snapshot.source, snapshot.edits, {
    format: 'png',
    name: snapshot.source.file.name.replace(/\.[^.]+$/, '') + '-edited',
    quality: 100,
    background: '#ffffff'
  });
  signal?.throwIfAborted();
  return file;
}
