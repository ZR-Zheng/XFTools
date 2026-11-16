import { compareJson } from './service';

describe('compareJson', () => {
  it('compares valid string contents without deleting comma/brace sequences', () => {
    expect(compareJson('{"text":",}"}', '{"text":"}"}', 'text')).not.toBe(
      'No differences found'
    );
    expect(() => compareJson('{"text":1,}', '{"text":1}', 'text')).toThrow();
  });
  it('compares root primitives, nulls, array shape and nested objects in both formats', () => {
    expect(compareJson('1', '2', 'text')).toContain('root: Mismatch');
    expect(compareJson('null', '{}', 'text')).toContain('root: Mismatch');
    expect(compareJson('[]', '{}', 'text')).toContain('root: Mismatch');
    expect(
      JSON.parse(compareJson('{"x":{"n":1}}', '{"x":{"n":1}}', 'json'))
    ).toEqual({});
    expect(
      JSON.parse(compareJson('{"x":{"n":1}}', '{"x":{"n":2}}', 'json'))
    ).toHaveProperty('x.n');
    expect(compareJson('{"__proto__":1}', '{}', 'text')).toContain(
      '__proto__: Missing'
    );
  });
  it('should identify missing properties', () => {
    const json1 = '{"name": "John", "age": 30}';
    const json2 = '{"name": "John"}';

    expect(compareJson(json1, json2, 'text')).toContain(
      'age: Missing in second JSON'
    );
  });

  it('should identify value mismatches', () => {
    const json1 = '{"name": "John", "age": 30}';
    const json2 = '{"name": "John", "age": 25}';

    expect(compareJson(json1, json2, 'text')).toContain(
      'age: Mismatch: 30 != 25'
    );
  });

  it('should handle nested objects', () => {
    const json1 = '{"person": {"name": "John", "age": 30}}';
    const json2 = '{"person": {"name": "Jane", "age": 30}}';

    expect(compareJson(json1, json2, 'text')).toContain(
      'person.name: Mismatch: John != Jane'
    );
  });

  it('should return JSON format when specified', () => {
    const json1 = '{"name": "John", "age": 30}';
    const json2 = '{"name": "Jane", "age": 25}';

    const result = compareJson(json1, json2, 'json');
    const parsed = JSON.parse(result);

    expect(parsed).toHaveProperty('name');
    expect(parsed).toHaveProperty('age');
  });

  it('should handle arrays', () => {
    const json1 = '{"numbers": [1, 2, 3]}';
    const json2 = '{"numbers": [1, 2, 4]}';

    expect(compareJson(json1, json2, 'text')).toContain(
      'numbers.2: Mismatch: 3 != 4'
    );
  });

  it('should return "No differences found" for identical JSONs', () => {
    const json1 = '{"name": "John", "age": 30}';
    const json2 = '{"name": "John", "age": 30}';

    expect(compareJson(json1, json2, 'text')).toBe('No differences found');
  });

  it('should throw error for invalid JSON', () => {
    const json1 = '{"name": "John"';
    const json2 = '{"name": "John"}';

    expect(() => compareJson(json1, json2, 'text')).toThrow();
  });
});
