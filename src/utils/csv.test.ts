import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  writeCsv,
  csvRowsToJson,
  csvCellValue,
  getCsvHeaders
} from './csv';
import { main as yamlFromCsv } from '../pages/tools/csv/csv-to-yaml/service';
import { parse as parseYaml } from 'yaml';

describe('shared delimited-data engine', () => {
  it('preserves complete quoted records, escaped quotes and significant whitespace', () => {
    const csv =
      '\uFEFFname,note\r\nAlice,"hello\r\nworld"\r\nBob,"a, b and ""quotes"""\r\nCat,"  spaced  "';
    const rows = parseCsv(csv);
    expect(rows).toEqual([
      ['name', 'note'],
      ['Alice', 'hello\r\nworld'],
      ['Bob', 'a, b and "quotes"'],
      ['Cat', '  spaced  ']
    ]);
    expect(
      parseCsv(writeCsv(rows, { delimiter: ';' }), { delimiter: ';' })
    ).toEqual(rows);
  });
  it('supports custom quotes and treats a quoted comment marker as data', () => {
    expect(
      parseCsv("#skip\n'a'|'x|y'\n'#keep'|'it''s valid'", {
        delimiter: '|',
        quoteChar: "'",
        comments: '#'
      })
    ).toEqual([
      ['a', 'x|y'],
      ['#keep', "it's valid"]
    ]);
  });
  it('reports malformed quotes instead of returning partial data', () => {
    expect(() => parseCsv('name,note\nAlice,"unterminated')).toThrow(
      /CSV record 2/
    );
  });
  it('keeps a half-entered header from crashing column option controls', () => {
    expect(getCsvHeaders('name,"unterminated')).toEqual([]);
    expect(getCsvHeaders('name,"column\nname"\nAlice,value')).toEqual([
      'name',
      'column\nname'
    ]);
  });
  it('does not lose identifiers, large integers, empty cells or duplicate headers', () => {
    expect(csvCellValue('00123', true)).toBe('00123');
    expect(csvCellValue('9007199254740993', true)).toBe('9007199254740993');
    expect(csvCellValue('', true)).toBe('');
    expect(csvCellValue('1.25', true)).toBe(1.25);
    const result = csvRowsToJson(
      [
        ['id', 'id', '__proto__'],
        ['001', '002', 'safe']
      ],
      true,
      true
    );
    expect(JSON.stringify(result)).toBe(
      '[{"id":"001","id_2":"002","__proto__":"safe"}]'
    );
    expect(() =>
      csvRowsToJson([['a', 'b'], ['only-one']], true, false)
    ).toThrow(/Expected 2 columns/);
  });
  it('serializes YAML values without changing their text or interpreting special keys', () => {
    const csv =
      'name,value,flag\nAlice,"a: b # comment",true\nBob,"one\ntwo",00123';
    const result = yamlFromCsv(csv, {
      csvSeparator: ',',
      quoteCharacter: '"',
      commentCharacter: '#',
      emptyLines: true,
      headerRow: true,
      spaces: 2
    });
    expect(parseYaml(result)).toEqual([
      { name: 'Alice', value: 'a: b # comment', flag: 'true' },
      { name: 'Bob', value: 'one\ntwo', flag: '00123' }
    ]);
  });
});
