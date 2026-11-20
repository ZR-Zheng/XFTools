import type { ToolCategory, ToolRoutePrefix } from './defineTool';

// URLs describe the original route; categories describe what a tool does.
const assignments: Record<
  string,
  { primary: ToolCategory; also?: ToolCategory[] }
> = {
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
  original: ToolRoutePrefix,
  declared: ToolCategory[] = []
) {
  const assignment = assignments[route];
  const primary =
    assignment?.primary ?? (original === 'number' ? 'converters' : original);
  const extra: ToolCategory[] = [...(assignment?.also || []), ...declared];
  if (route.startsWith('time/convert-')) extra.push('converters');
  return {
    primary,
    alternativeCategories: [...new Set(extra)].filter(
      (category) => category !== primary
    )
  };
}
export type ToolInteraction =
  | 'text'
  | 'compare'
  | 'image'
  | 'pdf'
  | 'media'
  | 'date';
export function getToolInteraction(
  route: string,
  category: ToolCategory
): ToolInteraction {
  if (/compare|comparison/.test(route)) return 'compare';
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
  return 'text';
}
