import { afterEach, expect, test } from 'vitest';
import i18n from './index';
import { uiText } from './uiText';

afterEach(() => {
  void i18n.changeLanguage('zh');
});
test('labels follow repeated language changes without caching a rendered language', async () => {
  await i18n.changeLanguage('zh');
  expect(uiText('First JSON')).toBe('第一份 JSON');
  await i18n.changeLanguage('en');
  expect(uiText('First JSON')).toBe('First JSON');
  await i18n.changeLanguage('zh');
  expect(uiText('First JSON')).toBe('第一份 JSON');
});
test('feedback translates its sentence and preserves the reported values', async () => {
  await i18n.changeLanguage('zh');
  expect(uiText('There are only 3 columns')).toBe('数据仅有 3 列');
  expect(uiText('Invalid JSON at line 7: Unexpected token')).toBe(
    '第 7 行的 JSON 无效：Unexpected token'
  );
  await i18n.changeLanguage('en');
  expect(uiText('There are only 3 columns')).toBe('There are only 3 columns');
});
test('legacy resource keys resolve in both supported languages', async () => {
  await i18n.changeLanguage('zh');
  expect(uiText('translation:categories.pdf.title')).toBe(
    i18n.t('categories.pdf.title')
  );
  await i18n.changeLanguage('en');
  expect(uiText('translation:categories.pdf.title')).toBe(
    i18n.t('categories.pdf.title')
  );
});

test('brand names and editorial slogans stay in their original language', async () => {
  await i18n.changeLanguage('zh');
  for (const text of [
    'XFTools',
    'YOUR EVERYDAY TOOLKIT',
    'Image studio',
    'PDF workspace',
    'LESS WORK. MORE FLOW.'
  ])
    expect(uiText(text)).toBe(text);
});
