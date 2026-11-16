import { parseCsv, csvRowsToJson } from '@utils/csv';

export interface CsvToJsonOptions {
  delimiter: string;
  quote: string;
  comment: string;
  useHeaders: boolean;
  skipEmptyLines: boolean;
  dynamicTypes: boolean;
}
export function convertCsvToJson(
  csv: string,
  options: Partial<CsvToJsonOptions> = {}
): string {
  const opts = {
    delimiter: ',',
    quote: '"',
    comment: '#',
    useHeaders: true,
    skipEmptyLines: true,
    dynamicTypes: false,
    ...options
  };
  const rows = parseCsv(csv, {
    delimiter: opts.delimiter,
    quoteChar: opts.quote,
    comments: opts.comment,
    skipEmptyLines: opts.skipEmptyLines
  });
  return JSON.stringify(
    csvRowsToJson(rows, opts.useHeaders, opts.dynamicTypes),
    null,
    2
  );
}
