type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type Difference = {
  path: string[];
  kind: 'missing-left' | 'missing-right' | 'replace';
  left?: JsonValue;
  right?: JsonValue;
};

function parse(input: string, name: string): JsonValue {
  if (!input.trim()) return {};
  try {
    return JSON.parse(input);
  } catch (error) {
    throw new Error(
      `${name}: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
      { cause: error }
    );
  }
}
function isContainer(
  value: JsonValue
): value is JsonValue[] | { [key: string]: JsonValue } {
  return value !== null && typeof value === 'object';
}
function differences(
  left: JsonValue,
  right: JsonValue,
  path: string[] = []
): Difference[] {
  if (left === right) return [];
  if (
    !isContainer(left) ||
    !isContainer(right) ||
    Array.isArray(left) !== Array.isArray(right)
  )
    return [{ path, kind: 'replace', left, right }];
  const result: Difference[] = [];
  const get = (
    value: JsonValue[] | { [key: string]: JsonValue },
    key: string
  ): JsonValue => (Array.isArray(value) ? value[Number(key)] : value[key]);
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    const currentPath = [...path, key];
    if (!Object.hasOwn(left, key))
      result.push({
        path: currentPath,
        kind: 'missing-left',
        right: get(right, key)
      });
    else if (!Object.hasOwn(right, key))
      result.push({
        path: currentPath,
        kind: 'missing-right',
        left: get(left, key)
      });
    else
      result.push(...differences(get(left, key), get(right, key), currentPath));
  }
  return result;
}
function pathLabel(path: string[]): string {
  if (!path.length) return 'root';
  return path
    .map((key, index) =>
      /^[\w$]+$/.test(key)
        ? `${index ? '.' : ''}${key}`
        : `[${JSON.stringify(key)}]`
    )
    .join('');
}
function message(diff: Difference): string {
  if (diff.kind === 'missing-left') return 'Missing in first JSON';
  if (diff.kind === 'missing-right') return 'Missing in second JSON';
  const show = (value: JsonValue | undefined) =>
    typeof value === 'string' ? value : JSON.stringify(value);
  return `Mismatch: ${show(diff.left)} != ${show(diff.right)}`;
}

/** Never repair or rewrite the input while comparing it. */
export function compareJson(
  json1: string,
  json2: string,
  format: 'text' | 'json'
): string {
  if (!json1.trim() && !json2.trim()) return '';
  const changes = differences(
    parse(json1, 'First JSON'),
    parse(json2, 'Second JSON')
  );
  if (format === 'json')
    return JSON.stringify(
      Object.fromEntries(
        changes.map((change) => [pathLabel(change.path), message(change)])
      ),
      null,
      2
    );
  return changes.length
    ? changes
        .map((change) => `${pathLabel(change.path)}: ${message(change)}`)
        .join('\n')
    : 'No differences found';
}
