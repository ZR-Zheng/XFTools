import type { InitialValuesType } from './types';
import { parseCsv, csvRowsToJson } from '@utils/csv';
import { stringify } from 'yaml';

export function main(input: string, options: InitialValuesType): string {
  if (!input) return '';
  if (
    !Number.isInteger(options.spaces) ||
    options.spaces < 1 ||
    options.spaces > 10
  )
    throw new Error('Indent spaces must be an integer between 1 and 10.');
  const rows = parseCsv(input, {
    delimiter: options.csvSeparator,
    quoteChar: options.quoteCharacter,
    comments: options.commentCharacter,
    skipEmptyLines: options.emptyLines
  });
  return stringify(csvRowsToJson(rows, options.headerRow, false), {
    indent: options.spaces,
    lineWidth: 0
  }).trimEnd();
}
