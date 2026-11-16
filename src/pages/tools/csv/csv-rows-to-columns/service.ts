import { parseCsv, writeCsv } from '@utils/csv';
import { transpose, normalizeAndFill } from '@utils/array';

export function csvRowsToColumns(
  input: string,
  emptyValuesFilling: boolean,
  customFiller: string,
  commentCharacter: string
): string {
  if (!input) return '';
  const rows = parseCsv(input, {
    comments: commentCharacter,
    skipEmptyLines: true
  });
  if (!rows.length) return '';
  const filler = emptyValuesFilling ? '' : customFiller;
  return writeCsv(
    transpose(
      normalizeAndFill(
        rows.map((row) => row.map((cell) => (cell === '' ? filler : cell))),
        filler
      )
    )
  );
}
