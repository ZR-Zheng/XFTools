import chinese from '../../public/locales/zh/ui.json';

export const interfaceCopy: Record<string, string> = {
  ...chinese,
  'Default prefix': '默认前缀'
};

/** Old option controls pass source text, rather than translation keys. */
export function registerInterfaceCopy(
  source: Record<string, unknown>,
  translated: Record<string, unknown>
) {
  for (const [key, value] of Object.entries(source)) {
    const target = translated[key];
    if (typeof value === 'string' && typeof target === 'string')
      interfaceCopy[value] ??= target;
    else if (
      value &&
      target &&
      typeof value === 'object' &&
      typeof target === 'object'
    )
      registerInterfaceCopy(
        value as Record<string, unknown>,
        target as Record<string, unknown>
      );
  }
}
