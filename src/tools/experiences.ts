/** Explicit page decisions. Adding a tool requires assigning its interaction here. */
export type PageLayout =
  | 'editor'
  | 'comparison'
  | 'form'
  | 'visual'
  | 'generator'
  | 'calculator'
  | 'custom';
export interface ToolExperience {
  layout: PageLayout;
  entry: 'text' | 'code' | 'list' | 'scalar' | 'cron' | 'file' | 'custom';
  rows: number;
  primaryGroups?: number[];
  placeholder?: [string, string];
  separator?: { input: string; output?: string; operator?: string };
  action?: [string, string];
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
  code: { layout: 'editor', entry: 'code', rows: 10, reference: 'it-tools' },
  list: { layout: 'editor', entry: 'list', rows: 8, reference: 'it-tools' },
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
  generator: {
    layout: 'generator',
    entry: 'custom',
    rows: 3,
    reference: 'it-tools'
  },
  calculator: {
    layout: 'calculator',
    entry: 'custom',
    rows: 2,
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
  'string/base64',
  'string/censor',
  'string/create-palindrome',
  'string/email-extractor',
  'string/extract-substring',
  'string/hidden-character-detector',
  'string/join',
  'string/palindrome',
  'string/quote',
  'string/randomize-case',
  'string/remove-duplicate-lines',
  'string/repeat',
  'string/reverse',
  'string/rot13',
  'string/rotate',
  'string/slug-generator',
  'string/split',
  'string/statistics',
  'string/table-text-converter',
  'string/replacer',
  'string/to-morse',
  'string/truncate',
  'string/unicode',
  'string/uppercase',
  'string/url-decode-string',
  'string/url-encode-string'
]);
assign('code', [
  'json/escape-json',
  'json/json-to-csv',
  'json/json-to-xml',
  'json/minify',
  'json/prettify',
  'json/sort',
  'json/stringify',
  'json/validateJson',
  'xml/xml-beautifier',
  'xml/xml-validator',
  'csv/change-csv-separator',
  'csv/csv-rows-to-columns',
  'csv/csv-to-json',
  'csv/csv-to-tsv',
  'csv/csv-to-xml',
  'csv/csv-to-yaml',
  'csv/find-incomplete-csv-records',
  'csv/insert-csv-columns',
  'csv/swap-csv-columns',
  'csv/transpose-csv',
  'csv/tsv-to-json'
]);
assign('list', [
  'list/duplicate',
  'list/find-most-popular',
  'list/find-unique',
  'list/chunk',
  'list/reverse',
  'list/rotate',
  'list/shuffle',
  'list/sort',
  'list/truncate',
  'list/unwrap',
  'list/wrap'
]);
assign('scalar', [
  'number/byte-converter',
  'number/number-to-words',
  'number/sum',
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
assign('comparison', ['string/text-compare', 'json/json-comparison']);
assign('generator', [
  'string/password-generator',
  'number/random-number-generator',
  'number/random-port-generator',
  'number/generate',
  'number/arithmetic-sequence',
  'image-generic/qr-code'
]);
assign('calculator', [
  'number/generic-calc/ohms-law',
  'number/generic-calc/cable-voltage-drop',
  'number/generic-calc/area-sphere',
  'number/generic-calc/volume-sphere',
  'number/generic-calc/slackline-tension'
]);
assign('custom', [
  'string/bcrypt',
  'string/url-editor',
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
  'string/base64': [0],
  'string/unicode': [0],
  'string/join': [0],
  'string/repeat': [0],
  'string/split': [0],
  'string/truncate': [0, 1],
  'string/replacer': [0, 1],
  'string/remove-duplicate-lines': [0],
  'string/statistics': [1],
  'list/sort': [1],
  'list/find-unique': [2],
  'list/find-most-popular': [1],
  'list/chunk': [1],
  'list/duplicate': [1],
  'list/reverse': [0],
  'list/rotate': [1],
  'list/shuffle': [1],
  'list/truncate': [1],
  'list/unwrap': [1],
  'list/wrap': [1],
  'csv/change-csv-separator': [1],
  'csv/csv-to-json': [1],
  'csv/csv-to-tsv': [1],
  'csv/csv-to-xml': [1],
  'csv/csv-to-yaml': [1],
  'csv/tsv-to-json': [1],
  'csv/insert-csv-columns': [0, 2],
  'csv/swap-csv-columns': [0, 1],
  'csv/find-incomplete-csv-records': [1],
  'image-generic/change-opacity': [0],
  'image-generic/compress': [0],
  'image-generic/image-to-text': [0],
  'image-generic/watermark': [0, 1],
  'image-generic/split-to-pages': [0, 1],
  'png/compress-png': [0],
  'video/add-audio': [0, 1, 2],
  'video/crop-video': [1],
  'video/resize': [0, 1, 2],
  'number/random-number-generator': [0, 1],
  'number/random-port-generator': [0, 1],
  'number/arithmetic-sequence': [0],
  'number/generate': [0]
};
for (const [route, primaryGroups] of Object.entries(primary))
  pages[route].primaryGroups = primaryGroups;
for (const route of [
  'list/duplicate',
  'list/find-most-popular',
  'list/find-unique',
  'list/chunk',
  'list/reverse',
  'list/rotate',
  'list/shuffle',
  'list/sort',
  'list/truncate',
  'list/unwrap',
  'list/wrap'
]) {
  pages[route].separator = {
    input: 'splitSeparator',
    operator: ['list/sort', 'list/find-most-popular'].includes(route)
      ? 'splitSeparatorType'
      : 'splitOperatorType'
  };
  pages[route].placeholder = [
    '每行输入一项，或选择分隔方式',
    'Enter one item per line, or choose a separator below'
  ];
}
for (const route of [
  'csv/change-csv-separator',
  'csv/csv-to-json',
  'csv/csv-to-tsv',
  'csv/csv-to-xml',
  'csv/csv-to-yaml',
  'csv/tsv-to-json'
]) {
  pages[route].placeholder = [
    'name,score\nAlice,10\nBob,20',
    'name,score\nAlice,10\nBob,20'
  ];
}
pages['string/password-generator'].action = ['生成密码', 'Generate password'];
pages['number/random-number-generator'].action = [
  '生成随机数',
  'Generate numbers'
];
pages['number/random-port-generator'].action = ['生成端口', 'Generate ports'];
pages['number/generate'].action = ['生成序列', 'Generate sequence'];
pages['number/arithmetic-sequence'].action = [
  '生成等差数列',
  'Generate sequence'
];
pages['image-generic/qr-code'].action = ['生成二维码', 'Generate QR code'];
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
