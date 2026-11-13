import { toWords as englishWords } from 'to-words/en-US';
import { toWords as chineseWords } from 'to-words/zh-CN';
import { InitialValuesType } from './types';
/** Convert each line using the selected UI language, preserving empty lines. */
export function numberToWords(input: string, options: InitialValuesType): string {
  if (!input) return '';
  const convert = localStorage.getItem('lang') === 'zh' ? chineseWords : englishWords;
  return input.split('\n').map(line => {
    const trimmed = line.trim(); if (!trimmed) return '';
    // Preserve the previous behavior without converting large integer strings to Number.
    const normalized = trimmed.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
    try { const result = convert(normalized, { useAnd: options.useAnd }); return options.uppercase ? result.toUpperCase() : result; } catch { return ''; }
  }).join('\n');
}
