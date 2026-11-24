import { afterEach, expect, test } from 'vitest';
import i18n, { ensureToolLocale } from './index';
import { uiText } from './uiText';
import { useWorkbenchText } from './workbench';

afterEach(() => {
  void i18n.changeLanguage('zh');
});

test('Chinese labels remain fixed and English is not an enabled interface', async () => {
  expect(i18n.options.supportedLngs).not.toContain('en');
  await i18n.changeLanguage('en');
  await ensureToolLocale('pdf');
  expect(uiText('First JSON')).toBe('第一份 JSON');
  expect(useWorkbenchText().english).toBe(false);
  expect(document.documentElement.lang).toBe('zh-CN');
  expect(localStorage.getItem('lang')).toBeNull();
});

test('feedback preserves reported values after the legacy labels are loaded', async () => {
  await ensureToolLocale('pdf');
  expect(uiText('Invalid JSON at line 7: Unexpected token')).toBe(
    '第 7 行的 JSON 无效：Unexpected token'
  );
});

test('tool resources register Chinese only, while legacy keys still resolve', async () => {
  await ensureToolLocale('pdf');
  expect(i18n.hasResourceBundle('en', 'pdf')).toBe(false);
  expect(uiText('translation:categories.pdf.title')).toBe(
    i18n.t('categories.pdf.title')
  );
  expect(i18n.t('pdf:compressPdf.shortDescription')).not.toContain('浏览器');
});

test('brand names and editorial slogans keep their original text', () => {
  for (const text of [
    'XFTools',
    'Image studio',
    'PDF workspace',
    'LESS WORK. MORE FLOW.'
  ])
    expect(uiText(text)).toBe(text);
});
