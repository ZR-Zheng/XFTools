import { describe, expect, it } from 'vitest';
import { textStatistics } from './service';
const options = {
  emptyLines: false,
  sentenceDelimiters: '',
  wordDelimiters: '',
  characterCount: false,
  wordCount: false
};
describe('Unicode text statistics', () => {
  it('counts visible graphemes, including composed accents and emoji families', () => {
    const result = textStatistics('e\u0301👨‍👩‍👧‍👦👍🏽', {
      ...options,
      characterCount: true
    });
    expect(result).toContain('Characters: 3');
    expect(result).toContain('👨‍👩‍👧‍👦: 1 (33.33%)');
  });
  it('segments Chinese words and sentences and preserves English contractions', () => {
    const result = textStatistics(
      "你好世界。Hello world! Don't panic.",
      options
    );
    expect(result).toContain('Words: 6');
    expect(result).toContain('Sentences: 3');
  });
  it('treats custom delimiters literally and supports Windows newlines', () => {
    const result = textStatistics('a b\r\n\r\nd', {
      ...options,
      wordDelimiters: '\\s',
      sentenceDelimiters: '],\\',
      emptyLines: true
    });
    expect(result).toContain('Words: 3');
    expect(result).toContain('Lines: 3');
    expect(result).toContain('Paragraphs: 2');
  });
  it('counts frequency keys such as __proto__ without treating them as object properties', () => {
    expect(
      textStatistics('__proto__ __proto__', {
        ...options,
        wordCount: true,
        wordDelimiters: ' '
      })
    ).toContain('__proto__: 2 (100.00%)');
  });
});
