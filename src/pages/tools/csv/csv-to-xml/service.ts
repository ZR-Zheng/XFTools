import type { InitialValuesType } from './types';
import { escapeMarkup } from '@utils/string';
import { normalizeXmlTagName } from '@utils/xml';
import { parseCsv } from '@utils/csv';

export function convertCsvToXml(
  csv: string,
  options: InitialValuesType
): string {
  const rows = parseCsv(csv, {
    delimiter: options.delimiter,
    quoteChar: options.quote,
    comments: options.comment,
    skipEmptyLines: options.skipEmptyLines
  });
  if (!rows.length)
    return '<?xml version="1.0" encoding="UTF-8" ?>\n<root></root>';
  const headers = options.useHeaders
    ? rows[0].map(normalizeXmlTagName)
    : Array.from(
        { length: Math.max(...rows.map((row) => row.length)) },
        (_, i) => `col${i + 1}`
      );
  const body = (options.useHeaders ? rows.slice(1) : rows)
    .map((row, index) => {
      if (row.length > headers.length)
        throw new Error(
          `CSV record ${index + 2} has more columns than the header.`
        );
      return (
        `  <row id="${index}">\n` +
        headers
          .map(
            (header, i) =>
              `    <${header}>${escapeMarkup(row[i] ?? '')}</${header}>\n`
          )
          .join('') +
        '  </row>\n'
      );
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" ?>\n<root>\n${body}</root>`;
}
