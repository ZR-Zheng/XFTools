import { InitialValuesType } from './types';

function graphemes(text: string): string[] {
  return typeof Intl.Segmenter === 'function'
    ? Array.from(
        new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(text),
        (part) => part.segment
      )
    : Array.from(text);
}

function frequency(items: string[], ignoreCase = false): string {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const key = ignoreCase ? item.toLocaleLowerCase() : item;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const visible: Record<string, string> = {
    ' ': '␣',
    '\n': '↲',
    '\r': '␍',
    '\t': '⇥',
    '\r\n': '␍↲'
  };
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(
      ([key, count]) =>
        `${Object.hasOwn(visible, key) ? visible[key] : key}: ${count} (${((count / items.length) * 100).toFixed(2)}%)`
    )
    .join('\n');
}

function countLines(text: string, options: InitialValuesType): number {
  const numberofLines = options.emptyLines
    ? text.split(/\r\n|\r|\n/).length
    : text.split(/\r\n|\r|\n/).filter((line) => line.trim() !== '').length;

  return numberofLines;
}

function countCharacters(text: string): number {
  return graphemes(text).length;
}

function countSentences(text: string, options: InitialValuesType): number {
  if (!options.sentenceDelimiters && typeof Intl.Segmenter === 'function')
    return Array.from(
      new Intl.Segmenter('zh', { granularity: 'sentence' }).segment(text)
    ).filter((part) => part.segment.trim()).length;
  const sentenceDelimiters = options.sentenceDelimiters
    ? options.sentenceDelimiters
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : ['.', '!', '?', '。', '！', '？'];
  const escaped = sentenceDelimiters
    .sort((a, b) => b.length - a.length)
    .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(escaped.join('|') || '(?!)', 'u');
  const sentences = text
    .split(regex)
    .filter((sentence) => sentence.trim() !== '');
  return sentences.length;
}

function wordsStats(
  text: string,
  options: InitialValuesType
): [number, string] {
  const words = options.wordDelimiters
    ? text
        .split(new RegExp(`[${options.wordDelimiters}]`, 'u'))
        .filter((word) => word.trim())
    : typeof Intl.Segmenter === 'function'
      ? Array.from(
          new Intl.Segmenter('zh', { granularity: 'word' }).segment(text)
        )
          .filter((part) => part.isWordLike)
          .map((part) => part.segment)
      : text.split(/[\s.,;:!?。！？、，；："“”«»()…]+/u).filter(Boolean);
  const wordsFrequency = options.wordCount ? frequency(words, true) : '';

  return options.wordCount
    ? [words.length, wordsFrequency]
    : [words.length, ''];
}

function countParagraphs(text: string): number {
  return text
    .split(/\r?\n\s*\r?\n/)
    .filter((paragraph) => paragraph.trim() !== '').length;
}

function charactersStatistic(text: string, options: InitialValuesType): string {
  if (!options.characterCount) return '';
  return frequency(graphemes(text));
}

export function textStatistics(
  input: string,
  options: InitialValuesType
): string {
  if (!input) return '';

  const numberofLines = countLines(input, options);
  const numberofCharacters = countCharacters(input);
  const numberofSentences = countSentences(input, options);
  const [numberofWords, wordsFrequency] = wordsStats(input, options);
  const numberofParagraphs = countParagraphs(input);
  const characterStats = charactersStatistic(input, options);

  const stats = `Text Statistics
==================
Characters: ${numberofCharacters}
Words: ${numberofWords}
Lines: ${numberofLines}
Sentences: ${numberofSentences}
Paragraphs: ${numberofParagraphs}`;

  const charStats = `Characters Frequency
==================
${characterStats}`;

  const wordStatsOutput = `Words Frequency
==================
${wordsFrequency}`;

  let result = stats;
  if (options.wordCount) result += `\n\n${wordStatsOutput}`;
  if (options.characterCount) result += `\n\n${charStats}`;

  return result;
}
