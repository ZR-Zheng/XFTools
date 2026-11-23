const imageConverter = 'image-generic/convert';
const imageCompressor = 'image-generic/compress';
const durationConverter = 'time/convert-duration';
const pdfWorkspace = 'pdf/workspace';

export const toolAliases = {
  'pdf/merge-pdf': { path: pdfWorkspace, query: 'mode=merge' },
  'pdf/split-pdf': { path: pdfWorkspace, query: 'mode=split' },
  'pdf/rotate-pdf': { path: pdfWorkspace, query: 'mode=rotate' },
  'pdf/editor': { path: pdfWorkspace, query: 'mode=editor' },
  'pdf/form-pdf': { path: pdfWorkspace, query: 'mode=form' },
  'pdf/convert-to-pdf': { path: pdfWorkspace, query: 'mode=images' },
  'pdf/compress-pdf': {
    path: pdfWorkspace,
    query: 'mode=export&format=compress'
  },
  'pdf/protect-pdf': {
    path: pdfWorkspace,
    query: 'mode=export&format=protect'
  },
  'pdf/extract-image-from-pdf': {
    path: pdfWorkspace,
    query: 'mode=export&format=extract'
  },
  'pdf/export': { path: pdfWorkspace, query: 'mode=export' },
  'pdf/pdf-to-png': { path: pdfWorkspace, query: 'mode=export&format=png' },
  'pdf/pdf-to-epub': { path: pdfWorkspace, query: 'mode=export&format=epub' },
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
