import type { InitialValuesType } from './types';
import { parseCsv, csvRowsToJson } from '@utils/csv';

export function convertTsvToJson(
  input: string,
  options: InitialValuesType
): string {
  if (!input) return '';
  const rows = parseCsv(input, {
    delimiter: options.delimiter,
    quoteChar: options.quote,
    comments: options.comment,
    skipEmptyLines: options.skipEmptyLines
  });
  const indent =
    options.indentationType === 'none'
      ? undefined
      : options.indentationType === 'tab'
        ? '\t'
        : options.spacesCount;
  return JSON.stringify(
    csvRowsToJson(rows, options.useHeaders, options.dynamicTypes),
    null,
    indent
  );
}
