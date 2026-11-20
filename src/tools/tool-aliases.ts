const imageConverter = 'image-generic/convert';
const imageCompressor = 'image-generic/compress';
const durationConverter = 'time/convert-duration';
const pdfExporter = 'pdf/export';

export const toolAliases = {
  'pdf/pdf-to-png': { path: pdfExporter, query: 'format=png' },
  'pdf/pdf-to-epub': { path: pdfExporter, query: 'format=epub' },
  'converters/convert-to-jpg': { path: imageConverter, query: 'format=jpg' },
  'converters/convert-to-webp': { path: imageConverter, query: 'format=webp' },
  'png/convert-jgp-to-png': { path: imageConverter, query: 'format=png' },
  'png/compress-png': { path: imageCompressor, query: 'mode=png' },
  'time/convert-days-to-hours': {
    path: durationConverter,
    query: 'mode=days-to-hours'
  },
  'time/convert-hours-to-days': {
    path: durationConverter,
    query: 'mode=hours-to-days'
  },
  'time/convert-seconds-to-time': {
    path: durationConverter,
    query: 'mode=seconds-to-time'
  },
  'time/convert-time-to-seconds': {
    path: durationConverter,
    query: 'mode=time-to-seconds'
  },
  'time/convert-time-to-decimal': {
    path: durationConverter,
    query: 'mode=time-to-decimal'
  }
} satisfies Record<string, { path: string; query: string }>;

export function canonicalToolPath(path: string): string {
  return Object.hasOwn(toolAliases, path)
    ? toolAliases[path as keyof typeof toolAliases].path
    : path;
}
