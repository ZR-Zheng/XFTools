export const interfaceCopy: Record<string, string> = {
  Loading: '正在加载',
  Navigation: '导航',
  Close: '关闭',
  'Default prefix': '默认前缀'
};

export const interfaceFeedback = new Map<
  string,
  { pattern: RegExp; translated: string }
>();

function setCopy(source: string, translated: string) {
  interfaceCopy[source] = translated;
  if (source.includes('{{0}}')) {
    const expression = source
      .split(/\{\{\d+\}\}/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('(.*?)');
    interfaceFeedback.set(source, {
      pattern: new RegExp(`^${expression}$`, 's'),
      translated
    });
  }
}

let legacyCopy: Promise<void> | undefined;
export function ensureLegacyInterfaceCopy() {
  legacyCopy ??= import('../../public/locales/zh/ui.json')
    .then(({ default: chinese }) => {
      for (const [source, translated] of Object.entries(chinese))
        setCopy(source, translated);
    })
    .catch((error: unknown) => {
      legacyCopy = undefined;
      throw error;
    });
  return legacyCopy;
}

/** Old option controls pass source text, rather than translation keys. */
export function registerInterfaceCopy(
  source: Record<string, unknown>,
  translated: Record<string, unknown>
) {
  for (const [key, value] of Object.entries(source)) {
    const target = translated[key];
    if (typeof value === 'string' && typeof target === 'string') {
      if (!Object.hasOwn(interfaceCopy, value)) setCopy(value, target);
    } else if (
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
