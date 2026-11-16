import { parseCsv, writeCsv } from '@utils/csv';

export function csvToTsv(
  input: string,
  delimiter: string,
  quoteCharacter: string,
  commentCharacter: string,
  header: boolean,
  emptyLines: boolean
): string {
  if (!input) return '';
  const rows = parseCsv(input, {
    delimiter,
    quoteChar: quoteCharacter,
    comments: commentCharacter,
    skipEmptyLines: emptyLines
  });
  return writeCsv(header ? rows : rows.slice(1), { delimiter: '\t' });
}
