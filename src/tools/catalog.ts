import type { ToolCategory, ToolRoutePrefix } from './defineTool';

// URLs describe the original route; categories describe what a tool does.
export function classifyTool(
  route: string,
  original: ToolRoutePrefix,
  declared: ToolCategory[] = []
) {
  const primary = original === 'image' ? 'image-generic' : original;
  const extra: ToolCategory[] = [...declared];
  if (route.startsWith('time/convert-')) extra.push('converters');
  return {
    primary,
    alternativeCategories: [...new Set(extra)].filter(
      (category) => category !== primary
    )
  };
}
export type ToolInteraction =
  'text' | 'compare' | 'image' | 'pdf' | 'media' | 'date' | 'chart';
export function getToolInteraction(
  route: string,
  category: ToolCategory
): ToolInteraction {
  if (/compare|comparison/.test(route)) return 'compare';
  if (/^time\//.test(route)) return 'date';
  if (category === 'pdf') return 'pdf';
  if (category === 'charts') return 'chart';
  if (/^(?:video|audio)\//.test(route) || /audio-converter|^gif\//.test(route))
    return 'media';
  if (/^(?:image|image-generic)\//.test(route)) return 'image';
  return 'text';
}
