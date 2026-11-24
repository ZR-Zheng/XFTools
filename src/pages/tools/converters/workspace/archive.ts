import { resultLimit } from './formats';

export async function archiveFiles(
  files: File[],
  name: string,
  signal?: AbortSignal
) {
  if (files.reduce((size, file) => size + file.size, 0) > resultLimit)
    throw new Error('打包文件总量超过 160 MB，请逐个下载。');
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const names = new Set<string>();
  for (const file of files) {
    signal?.throwIfAborted();
    const basename = Array.from(file.name, (character) =>
      character < ' ' || '\\/:*?"<>|'.includes(character) ? '_' : character
    ).join('');
    const lastDot = basename.lastIndexOf('.');
    const dot = lastDot > 0 ? lastDot : basename.length;
    let filename = basename;
    for (let i = 2; names.has(filename.toLowerCase()); i++) {
      filename = `${basename.slice(0, dot)} (${i})${basename.slice(dot)}`;
    }
    names.add(filename.toLowerCase());
    zip.file(filename, await file.arrayBuffer());
  }
  const blob = await zip.generateAsync({ type: 'blob', streamFiles: true });
  signal?.throwIfAborted();
  return new File([blob], name, { type: 'application/zip' });
}
