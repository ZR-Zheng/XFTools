import Papa from 'papaparse';

export class CsvParseError extends Error {
  constructor(
    public readonly row: number,
    detail: string
  ) {
    super(`CSV record ${row}: ${detail}`);
    this.name = 'CsvParseError';
  }
}

export interface CsvReadOptions {
  delimiter?: string;
  quoteChar?: string;
  comments?: string;
  skipEmptyLines?: boolean;
}

/** Decode complete records, including quoted delimiters, escapes and newlines. */
export function parseCsv(
  input: string,
  options: CsvReadOptions = {}
): string[][] {
  if (!input) return [];
  const delimiter = options.delimiter ?? ',';
  const quoteChar = options.quoteChar ?? '"';
  if (!delimiter || /[\r\n]/.test(delimiter) || delimiter.includes(quoteChar))
    throw new Error(
      'Choose a non-empty CSV separator different from the quote character.'
    );
  if (quoteChar.length !== 1)
    throw new Error('The CSV quote character must be one character.');
  const parsed = Papa.parse<string[]>(input, {
    delimiter,
    quoteChar,
    escapeChar: quoteChar,
    comments: options.comments || false,
    skipEmptyLines: options.skipEmptyLines ? 'greedy' : false,
    dynamicTyping: false
  });
  const error = parsed.errors[0];
  if (error) throw new CsvParseError((error.row ?? 0) + 1, error.message);
  return parsed.data;
}

/** Serialize actual cells once; callers must not add/remove quotes themselves. */
export function writeCsv(
  rows: readonly (readonly unknown[])[],
  options: {
    delimiter?: string;
    quoteChar?: string;
    quotes?: boolean;
    escapeFormulae?: boolean;
  } = {}
): string {
  if (!rows.length) return '';
  const delimiter = options.delimiter ?? ',',
    quoteChar = options.quoteChar || '"';
  if (!delimiter || /[\r\n]/.test(delimiter) || delimiter.includes(quoteChar))
    throw new Error(
      'Choose a non-empty CSV separator different from the quote character.'
    );
  if (quoteChar.length !== 1)
    throw new Error('The CSV quote character must be one character.');
  return Papa.unparse(
    rows.map((row) => row.map((cell) => (cell == null ? '' : String(cell)))),
    {
      delimiter,
      quoteChar,
      escapeChar: quoteChar,
      quotes: options.quotes ?? false,
      newline: '\n',
      escapeFormulae: options.escapeFormulae ?? false
    }
  );
}

/** Existing tools keep their option signatures while sharing the same parser. */
export function splitCsv(
  input: string,
  deleteComment: boolean,
  commentCharacter: string,
  deleteEmptyLines: boolean,
  delimiter = ',',
  quoteChar = '"'
): string[][] {
  return parseCsv(input, {
    delimiter,
    quoteChar,
    comments: deleteComment ? commentCharacter : undefined,
    skipEmptyLines: deleteEmptyLines
  });
}

export function getCsvHeaders(
  input: string,
  delimiter = ',',
  quoteChar = '"',
  comments?: string
): string[] {
  // Header options render while users type. Parsing errors are reported by the
  // actual transform, rather than crashing the form on a half-entered quote.
  try {
    return (
      parseCsv(input, {
        delimiter,
        quoteChar,
        comments,
        skipEmptyLines: true
      })[0] || []
    );
  } catch {
    return [];
  }
}

/** Preserve every column even if the source contains duplicate or empty headers. */
export function uniqueCsvHeaders(headers: string[]): string[] {
  const used = new Set<string>();
  return headers.map((header, index) => {
    const base = header || `column_${index + 1}`;
    let key = base,
      suffix = 2;
    while (used.has(key)) key = `${base}_${suffix++}`;
    used.add(key);
    return key;
  });
}

export function csvCellValue(
  value: string,
  dynamic: boolean
): string | number | boolean | null {
  if (!dynamic || !value.trim()) return value;
  if (/^true$/i.test(value)) return true;
  if (/^false$/i.test(value)) return false;
  if (value === 'null') return null;
  // Identifiers with leading zeroes and unsafe integers must remain lossless strings.
  if (/^[+-]?0\d/.test(value)) return value;
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) {
    const number = Number(value);
    if (Number.isFinite(number) && Math.abs(number) <= Number.MAX_SAFE_INTEGER)
      return number;
  }
  return value;
}

export function csvRowsToJson(
  rows: string[][],
  headers: boolean,
  dynamic: boolean
): unknown[] {
  if (!rows.length) return [];
  if (!headers)
    return rows.map((row) => row.map((cell) => csvCellValue(cell, dynamic)));
  const keys = uniqueCsvHeaders(rows[0]);
  return rows.slice(1).map((row, index) => {
    if (row.length !== keys.length)
      throw new CsvParseError(
        index + 2,
        `Expected ${keys.length} columns, received ${row.length}.`
      );
    return Object.fromEntries(
      keys.map((key, i) => [key, csvCellValue(row[i], dynamic)])
    );
  });
}
