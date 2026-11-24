/** Explicit page decisions. Adding a tool requires assigning its interaction here. */
export type PageLayout = 'editor' | 'comparison' | 'form' | 'visual' | 'custom';
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
assign('scalar', [
  'number/byte-converter',
  'time/check-leap-years',
  'time/truncate-clock-time'
]);
assign('date', ['time/convert-unix-to-date', 'time/discord-timestamp']);
assign('form', ['time/date-weekday-calculator', 'time/time-between-dates']);
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
assign('custom', ['time/convert-duration', 'image/workspace', 'pdf/workspace']);
pages['time/crontab-guru'] = {
  layout: 'form',
  entry: 'cron',
  rows: 1,
  placeholder: ['例如：0 9 * * 1-5', 'For example: 0 9 * * 1-5'],
  reference: 'it-tools'
};

const primary: Record<string, number[]> = {
  'video/add-audio': [0, 1, 2],
  'video/crop-video': [1],
  'video/resize': [0, 1, 2]
};
for (const [route, primaryGroups] of Object.entries(primary))
  pages[route].primaryGroups = primaryGroups;
pages['time/truncate-clock-time'].placeholder = [
  '例如：12:34:56',
  'For example: 12:34:56'
];
export const toolExperiences: Readonly<Record<string, ToolExperience>> = pages;
export const defaultExperience: ToolExperience = profiles.text;
