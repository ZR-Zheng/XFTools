const imageWorkspace = 'image/workspace';
const calculator = 'time/calculator';
const pdfWorkspace = 'pdf/workspace';
const videoWorkspace = 'video/workspace';
const audioWorkspace = 'audio/workspace';
const conversionWorkspace = 'converters/workspace';

export const toolAliases = {
  'audio/trim': { path: audioWorkspace, query: 'panel=clip' },
  'audio/change-speed': { path: audioWorkspace, query: 'panel=effects' },
  'audio/loop': { path: audioWorkspace, query: 'panel=loop' },
  'audio/merge-audio': { path: audioWorkspace, query: 'panel=clip' },
  'converters/audio-converter': {
    path: conversionWorkspace,
    query: 'group=audio'
  },
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
    path: conversionWorkspace,
    query: 'group=video&format=gif'
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
    path: conversionWorkspace,
    query: 'group=image&format=jpg'
  },
  'converters/convert-to-webp': {
    path: conversionWorkspace,
    query: 'group=image&format=webp'
  },
  'png/convert-jgp-to-png': {
    path: imageWorkspace,
    query: 'tab=batch&operation=convert&format=png'
  },
  'png/compress-png': {
    path: imageWorkspace,
    query: 'tab=batch&operation=compress&mode=png'
  },
  'time/convert-duration': { path: calculator, query: 'view=duration' },
  'time/convert-days-to-hours': {
    path: calculator,
    query: 'view=duration&mode=days-to-hours'
  },
  'time/convert-hours-to-days': {
    path: calculator,
    query: 'view=duration&mode=hours-to-days'
  },
  'time/convert-seconds-to-time': {
    path: calculator,
    query: 'view=duration&mode=seconds-to-time'
  },
  'time/convert-time-to-seconds': {
    path: calculator,
    query: 'view=duration&mode=time-to-seconds'
  },
  'time/convert-time-to-decimal': {
    path: calculator,
    query: 'view=duration&mode=time-to-decimal'
  },
  'time/convert-unix-to-date': { path: calculator, query: 'view=unix' },
  'time/time-between-dates': {
    path: calculator,
    query: 'view=difference&precision=time'
  },
  'time/date-weekday-calculator': { path: calculator, query: 'view=weekday' },
  'time/check-leap-years': { path: calculator, query: 'view=leap' },
  'time/truncate-clock-time': { path: calculator, query: 'view=truncate' },
  'time/discord-timestamp': { path: calculator, query: 'view=discord' },
  'time/crontab-guru': { path: calculator, query: 'view=cron' }
} satisfies Record<string, { path: string; query: string }>;

export function canonicalToolPath(path: string): string {
  return Object.hasOwn(toolAliases, path)
    ? toolAliases[path as keyof typeof toolAliases].path
    : path;
}
