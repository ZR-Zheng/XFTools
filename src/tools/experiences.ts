/** Explicit page decisions. Adding a tool requires assigning its interaction here. */
export type PageLayout =
  | 'editor'
  | 'comparison'
  | 'form'
  | 'visual'
  | 'custom';
export interface ToolExperience {
  layout: PageLayout;
  entry: 'text' | 'scalar' | 'cron' | 'file' | 'custom';
  rows: number;
  primaryGroups?: number[];
  placeholder?: [string, string];
  reference:
    | 'cyberchef'
    | 'it-tools'
    | 'pdf24'
    | 'squoosh'
    | 'audiomass'
    | 'epoch'
    | 'iloveimg';
}
const profiles: Record<string, ToolExperience> = {
  text: { layout: 'editor', entry: 'text', rows: 8, reference: 'cyberchef' },
  scalar: {
    layout: 'form',
    entry: 'scalar',
    rows: 2,
    placeholder: [
      '输入数值；批量处理时每行一个',
      'Enter a value, or one value per line'
    ],
    reference: 'it-tools'
  },
  date: { layout: 'form', entry: 'scalar', rows: 2, reference: 'epoch' },
  form: { layout: 'form', entry: 'custom', rows: 2, reference: 'it-tools' },
  image: { layout: 'visual', entry: 'file', rows: 6, reference: 'squoosh' },
  pdf: { layout: 'visual', entry: 'file', rows: 6, reference: 'pdf24' },
  media: { layout: 'visual', entry: 'file', rows: 6, reference: 'audiomass' },
  comparison: {
    layout: 'comparison',
    entry: 'text',
    rows: 8,
    reference: 'it-tools'
  },
  custom: { layout: 'custom', entry: 'custom', rows: 6, reference: 'it-tools' }
};
const pages: Record<string, ToolExperience> = {};
function assign(profile: keyof typeof profiles, routes: string[]) {
  for (const route of routes) {
    if (pages[route]) throw new Error(`Duplicate tool page: ${route}`);
    pages[route] = { ...profiles[profile] };
  }
}
assign('text', [
  'string/censor',
  'string/create-palindrome',
  'string/email-extractor',
  'string/extract-substring',
  'string/hidden-character-detector',
  'string/join',
  'string/palindrome',
  'string/quote',
  'string/randomize-case',
  'string/repeat',
  'string/reverse',
  'string/rotate',
  'string/split',
  'string/statistics',
  'string/replacer',
  'string/truncate',
  'string/uppercase'
]);
assign('scalar', [
  'number/byte-converter',
  'time/check-leap-years',
  'time/convert-days-to-hours',
  'time/convert-hours-to-days',
  'time/convert-seconds-to-time',
  'time/convert-time-to-decimal',
  'time/convert-time-to-seconds',
  'time/truncate-clock-time'
]);
assign('date', ['time/convert-unix-to-date', 'time/discord-timestamp']);
assign('form', ['time/date-weekday-calculator', 'time/time-between-dates']);
assign('image', [
  'image-generic/change-colors',
  'image-generic/change-opacity',
  'image-generic/compress',
  'image-generic/create-transparent',
  'image-generic/crop',
  'image-generic/image-to-text',
  'image-generic/remove-background',
  'image-generic/rotate',
  'image-generic/split-to-pages',
  'image-generic/watermark',
  'png/compress-png',
  'png/convert-jgp-to-png',
  'converters/convert-to-jpg',
  'converters/convert-to-webp'
]);
assign('pdf', [
  'pdf/compress-pdf',
  'pdf/convert-to-pdf',
  'pdf/extract-image-from-pdf',
  'pdf/merge-pdf',
  'pdf/pdf-to-epub',
  'pdf/pdf-to-png',
  'pdf/protect-pdf',
  'pdf/rotate-pdf',
  'pdf/split-pdf'
]);
assign('media', [
  'audio/change-speed',
  'audio/extract-audio',
  'audio/loop',
  'audio/merge-audio',
  'audio/trim',
  'video/add-audio',
  'video/change-speed',
  'video/compress',
  'video/crop-video',
  'video/flip',
  'video/loop',
  'video/merge-video',
  'video/resize',
  'video/rotate',
  'video/trim',
  'gif/change-speed',
  'gif/images-to-gif',
  'converters/audio-converter',
  'converters/video-to-gif'
]);
assign('comparison', ['string/text-compare']);
assign('custom', [
  'image-generic/editor',
  'image-generic/resize',
  'pdf/editor',
  'pdf/form-pdf'
]);
pages['image-generic/resize'].reference = 'iloveimg';
pages['time/crontab-guru'] = {
  layout: 'form',
  entry: 'cron',
  rows: 1,
  placeholder: ['例如：0 9 * * 1-5', 'For example: 0 9 * * 1-5'],
  reference: 'it-tools'
};

const primary: Record<string, number[]> = {
  'string/join': [0],
  'string/repeat': [0],
  'string/split': [0],
  'string/truncate': [0, 1],
  'string/replacer': [0, 1],
  'string/statistics': [1],
  'image-generic/change-opacity': [0],
  'image-generic/compress': [0],
  'image-generic/image-to-text': [0],
  'image-generic/watermark': [0, 1],
  'image-generic/split-to-pages': [0, 1],
  'png/compress-png': [0],
  'video/add-audio': [0, 1, 2],
  'video/crop-video': [1],
  'video/resize': [0, 1, 2]
};
for (const [route, primaryGroups] of Object.entries(primary))
  pages[route].primaryGroups = primaryGroups;
pages['time/convert-time-to-seconds'].placeholder = [
  '例如：01:30:00，支持每行一个',
  'For example: 01:30:00, one time per line'
];
pages['time/convert-seconds-to-time'].placeholder = [
  '例如：5400，支持每行一个',
  'For example: 5400, one value per line'
];
pages['time/convert-time-to-decimal'].placeholder = [
  '例如：01:30:00',
  'For example: 01:30:00'
];
pages['time/truncate-clock-time'].placeholder = [
  '例如：12:34:56',
  'For example: 12:34:56'
];
export const toolExperiences: Readonly<Record<string, ToolExperience>> = pages;
export const defaultExperience: ToolExperience = profiles.text;
