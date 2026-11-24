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
    | 'format-factory'
    | 'line-chart-assistant'
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
assign('custom', [
  'audio/workspace',
  'time/calculator',
  'image/workspace',
  'pdf/workspace',
  'video/workspace'
]);
pages['converters/workspace'] = {
  ...profiles.custom,
  reference: 'format-factory'
};
pages['charts/board'] = {
  ...profiles.custom,
  reference: 'line-chart-assistant'
};
export const calculatorModeExperiences: Readonly<
  Record<string, ToolExperience>
> = {
  'time/check-leap-years': profiles.scalar,
  'time/truncate-clock-time': {
    ...profiles.scalar,
    placeholder: ['例如：12:34:56', 'For example: 12:34:56']
  },
  'time/discord-timestamp': profiles.date,
  'time/date-weekday-calculator': profiles.form,
  'time/crontab-guru': {
    layout: 'form',
    entry: 'cron',
    rows: 1,
    placeholder: ['例如：0 9 * * 1-5', 'For example: 0 9 * * 1-5'],
    reference: 'it-tools'
  }
};
export const toolExperiences: Readonly<Record<string, ToolExperience>> = pages;
export const defaultExperience: ToolExperience = profiles.text;
