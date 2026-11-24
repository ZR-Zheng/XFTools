import type { ToolCategory, ToolRoutePrefix } from './defineTool';

// URLs describe the original route; categories describe what a tool does.
const assignments: Record<
  string,
  { primary: ToolCategory; also?: ToolCategory[] }
> = {
  'image/workspace': {
    primary: 'image-generic',
    also: ['converters']
  },
  'converters/audio-converter': { primary: 'audio', also: ['converters'] }
};
export function classifyTool(
  route: string,
  original: ToolRoutePrefix,
  declared: ToolCategory[] = []
) {
  const assignment = assignments[route];
  const primary =
    assignment?.primary ??
    (original === 'number'
      ? 'converters'
      : original === 'image'
        ? 'image-generic'
        : original);
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
  'text' | 'compare' | 'image' | 'pdf' | 'media' | 'date';
export function getToolInteraction(
  route: string,
  category: ToolCategory
): ToolInteraction {
  if (/compare|comparison/.test(route)) return 'compare';
  if (/^time\//.test(route)) return 'date';
  if (category === 'pdf') return 'pdf';
  if (
    /^(?:video|audio)\//.test(route) ||
    /audio-converter|^gif\//.test(route)
  )
    return 'media';
  if (/^(?:image|image-generic)\//.test(route)) return 'image';
  return 'text';
}
