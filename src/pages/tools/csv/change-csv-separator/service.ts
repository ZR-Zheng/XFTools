import { InitialValuesType } from './types';
import { splitCsv, writeCsv } from '@utils/csv';

export function changeCsvSeparator(
  input: string,
  options: InitialValuesType
): string {
  if (!input) return '';

  const rows = splitCsv(
    input,
    true,
    options.commentCharacter,
    options.emptyLines,
    options.inputSeparator,
    options.inputQuoteCharacter
  );

  return writeCsv(rows, {
    delimiter: options.outputSeparator,
    quoteChar: options.OutputQuoteCharacter,
    quotes: options.outputQuoteAll
  });
}
