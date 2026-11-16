import type { ToolCategory } from './defineTool';

// URLs describe the original route; categories describe what a tool does.
const assignments: Record<
  string,
  { primary: ToolCategory; also?: ToolCategory[] }
> = {
  'string/base64': { primary: 'encoding', also: ['converters'] },
  'string/unicode': { primary: 'encoding', also: ['converters'] },
  'string/rot13': { primary: 'encoding' },
  'string/to-morse': { primary: 'encoding', also: ['converters'] },
  'string/url-encode-string': {
    primary: 'encoding',
    also: ['network', 'converters']
  },
  'string/url-decode-string': {
    primary: 'encoding',
    also: ['network', 'converters']
  },
  'string/url-editor': { primary: 'network' },
  'string/slug-generator': { primary: 'network', also: ['string'] },
  'string/bcrypt': { primary: 'security' },
  'string/password-generator': { primary: 'security' },
  'string/table-text-converter': {
    primary: 'csv',
    also: ['string', 'converters']
  },
  'string/remove-duplicate-lines': { primary: 'list', also: ['string'] },
  'number/random-port-generator': { primary: 'network' },
  'number/byte-converter': { primary: 'converters', also: ['number'] },
  'converters/convert-to-jpg': {
    primary: 'image-generic',
    also: ['converters']
  },
  'converters/convert-to-webp': {
    primary: 'image-generic',
    also: ['converters']
  },
  'converters/audio-converter': { primary: 'audio', also: ['converters'] },
  'converters/video-to-gif': { primary: 'gif', also: ['video', 'converters'] },
  'audio/extract-audio': { primary: 'audio', also: ['video', 'converters'] },
  'png/compress-png': { primary: 'image-generic', also: ['png'] },
  'png/convert-jgp-to-png': {
    primary: 'image-generic',
    also: ['png', 'converters']
  },
  'image-generic/create-transparent': {
    primary: 'image-generic',
    also: ['png']
  },
  'image-generic/qr-code': { primary: 'encoding', also: ['image-generic'] },
  'image-generic/image-to-text': {
    primary: 'image-generic',
    also: ['string', 'converters']
  },
  'pdf/pdf-to-png': {
    primary: 'pdf',
    also: ['image-generic', 'png', 'converters']
  },
  'pdf/pdf-to-epub': { primary: 'pdf', also: ['converters'] },
  'pdf/convert-to-pdf': {
    primary: 'pdf',
    also: ['image-generic', 'converters']
  }
};
export function classifyTool(
  route: string,
  original: ToolCategory,
  declared: ToolCategory[] = []
) {
  const assignment = assignments[route];
  const primary: ToolCategory =
    assignment?.primary ||
    (route.startsWith('number/generic-calc/') ? 'calculator' : original);
  const extra: ToolCategory[] = [...(assignment?.also || []), ...declared];
  if (
    /^(?:json|csv)\/(?:json|csv|tsv)-to-(?:json|csv|tsv|xml|yaml)$/.test(
      route
    ) ||
    /^time\/convert-/.test(route) ||
    route === 'number/number-to-words'
  )
    extra.push('converters');
  if (route.startsWith('json/json-to-xml')) extra.push('xml');
  if (route.startsWith('json/json-to-csv')) extra.push('csv');
  if (route.startsWith('csv/') && route.endsWith('-to-json'))
    extra.push('json');
  if (route === 'csv/csv-to-xml') extra.push('xml');
  return {
    primary,
    alternativeCategories: [...new Set(extra)].filter(
      (category) => category !== primary
    )
  };
}
export type ToolInteraction =
  | 'text'
  | 'code'
  | 'compare'
  | 'image'
  | 'pdf'
  | 'media'
  | 'calculator'
  | 'generator'
  | 'date'
  | 'table';
export function getToolInteraction(
  route: string,
  category: ToolCategory
): ToolInteraction {
  if (/compare|comparison/.test(route)) return 'compare';
  if (
    /password-generator|random-number-generator|random-port-generator|qr-code|number\/generate|arithmetic-sequence/.test(
      route
    )
  )
    return 'generator';
  if (category === 'calculator') return 'calculator';
  if (/^time\//.test(route)) return 'date';
  if (category === 'pdf') return 'pdf';
  if (
    /^(?:video|audio)\//.test(route) ||
    /audio-converter|video-to-gif|^gif\//.test(route)
  )
    return 'media';
  if (
    /^(?:image-generic|png)\//.test(route) ||
    /convert-to-(?:jpg|webp)/.test(route)
  )
    return 'image';
  if (/^json\/|^xml\//.test(route)) return 'code';
  if (/^csv\/|table-text/.test(route)) return 'table';
  return 'text';
}
