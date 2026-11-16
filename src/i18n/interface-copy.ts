import chinese from '../../public/locales/zh/ui.json';

export const interfaceCopy: Record<string, string> = {
  ...chinese,
  'Default prefix': '默认前缀',
  'Quoted field unterminated': '带引号的字段缺少结束引号',
  'Trailing quote on quoted field is malformed': '字段的结束引号格式不正确',
  'Expected {{0}} columns, received {{1}}.': '预期 {{0}} 列，实际有 {{1}} 列。'
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
