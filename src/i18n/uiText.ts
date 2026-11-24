import i18n from './index';
import { interfaceCopy as copy, interfaceFeedback } from './interface-copy';
/** Localize interface labels and examples; never apply to user input or tool output. */
export function uiText<T>(value: T): T {
  if (typeof value !== 'string') return value;
  const translation = copy[value] || copy[value.replace(/\s+/g, ' ').trim()];
  if (translation) return translation as T;
  {
    for (const { pattern, translated } of interfaceFeedback.values()) {
      const match = value.match(pattern);
      if (match)
        return translated.replace(
          /\{\{(\d+)\}\}/g,
          (_, index: string) => match[Number(index) + 1]
        ) as T;
    }
    const explanation = value.match(/^What (?:is|Is) (?:a |an )?(.+?)\s*\?$/);
    if (explanation) return `什么是${explanation[1]}？` as T;
    if (/^e\.g\.\s*/.test(value))
      return value.replace(/^e\.g\.\s*/, '例如：') as T;
  }
  // Older tools sometimes pass a resource key directly to a shared option control.
  if (/^(?:\w+:)?[a-zA-Z][\w-]*(?:\.[\w-]+)+$/.test(value)) {
    const [explicitNamespace, key] = value.includes(':')
      ? value.split(':', 2)
      : [undefined, value];
    for (const namespace of explicitNamespace
      ? [explicitNamespace]
      : [
          'translation',
          'image',
          'video',
          'audio',
          'pdf',
          'time',
          'converters'
        ]) {
      const resolved: unknown = i18n.getResource('zh', namespace, key);
      if (typeof resolved === 'string') return resolved as T;
    }
  }
  return value;
}
