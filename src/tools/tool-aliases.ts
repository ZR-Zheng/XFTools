const imageWorkspace = 'image/workspace';
const durationConverter = 'time/convert-duration';
const pdfWorkspace = 'pdf/workspace';
const videoWorkspace = 'video/workspace';

export const toolAliases = {
  'gif/change-speed': { path: videoWorkspace, query: 'panel=clip&format=gif' },
  'gif/images-to-gif': {
    path: videoWorkspace,
    query: 'panel=clip&format=gif&preset=images'
  },
  'video/trim': { path: videoWorkspace, query: 'panel=clip' },
  'video/merge-video': { path: videoWorkspace, query: 'panel=clip' },
  'video/loop': { path: videoWorkspace, query: 'panel=clip' },
  'video/change-speed': { path: videoWorkspace, query: 'panel=clip' },
  'video/crop-video': { path: videoWorkspace, query: 'panel=picture' },
  'video/rotate': { path: videoWorkspace, query: 'panel=picture' },
  'video/flip': { path: videoWorkspace, query: 'panel=picture' },
  'video/add-audio': { path: videoWorkspace, query: 'panel=audio' },
  'video/resize': {
    path: videoWorkspace,
    query: 'panel=export&format=mp4&preset=resize'
  },
  'video/compress': {
    path: videoWorkspace,
    query: 'panel=export&format=mp4&preset=compress'
  },
  'audio/extract-audio': {
    path: videoWorkspace,
    query: 'panel=export&format=mp3'
  },
  'converters/video-to-gif': {
    path: videoWorkspace,
    query: 'panel=export&format=gif'
  },
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
  'image-generic/editor': { path: imageWorkspace, query: 'tab=edit' },
  'image-generic/crop': { path: imageWorkspace, query: 'tab=edit&tool=crop' },
  'image-generic/rotate': {
    path: imageWorkspace,
    query: 'tab=edit&tool=rotate'
  },
  'image-generic/change-opacity': {
    path: imageWorkspace,
    query: 'tab=edit&tool=opacity'
  },
  'image-generic/change-colors': {
    path: imageWorkspace,
    query: 'tab=edit&tool=mask&mask=replace'
  },
  'image-generic/create-transparent': {
    path: imageWorkspace,
    query: 'tab=edit&tool=mask&mask=transparent'
  },
  'image-generic/remove-background': {
    path: imageWorkspace,
    query: 'tab=background'
  },
  'image-generic/split-to-pages': { path: imageWorkspace, query: 'tab=print' },
  'image-generic/resize': {
    path: imageWorkspace,
    query: 'tab=batch&operation=resize'
  },
  'image-generic/watermark': {
    path: imageWorkspace,
    query: 'tab=batch&operation=watermark'
  },
  'image-generic/convert': {
    path: imageWorkspace,
    query: 'tab=batch&operation=convert'
  },
  'image-generic/compress': {
    path: imageWorkspace,
    query: 'tab=batch&operation=compress'
  },
  'converters/convert-to-jpg': {
    path: imageWorkspace,
    query: 'tab=batch&operation=convert&format=jpg'
  },
  'converters/convert-to-webp': {
    path: imageWorkspace,
    query: 'tab=batch&operation=convert&format=webp'
  },
  'png/convert-jgp-to-png': {
    path: imageWorkspace,
    query: 'tab=batch&operation=convert&format=png'
  },
  'png/compress-png': {
    path: imageWorkspace,
    query: 'tab=batch&operation=compress&mode=png'
  },
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
