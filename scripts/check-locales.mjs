import fs from 'node:fs';
import assert from 'node:assert/strict';
const root = 'public/locales';
assert.deepEqual(
  fs.readdirSync(root).sort(),
  ['en', 'zh'],
  'Expected Chinese resources and source-text references'
);
const flatten = (value, prefix = '') =>
  Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) =>
      child && typeof child === 'object' && !Array.isArray(child)
        ? Object.entries(flatten(child, prefix + key + '.'))
        : [[prefix + key, child]]
    )
  );
const placeholders = (value) =>
  [
    ...new Set(
      [...String(value).matchAll(/{{\s*([^}]+?)\s*}}/g)]
        .map((match) => match[1])
        .filter((key) => key !== 'plural')
    )
  ].sort();
let count = 0;
for (const name of fs.readdirSync(root + '/en')) {
  const en = flatten(JSON.parse(fs.readFileSync(root + '/en/' + name, 'utf8')));
  const zh = flatten(JSON.parse(fs.readFileSync(root + '/zh/' + name, 'utf8')));
  for (const [key, text] of Object.entries(en)) {
    assert.equal(typeof text, 'string', name + ':' + key);
    assert.ok(text.trim(), 'Empty translation: ' + name + ':' + key);
    assert.ok(
      zh[key] !== undefined,
      'Missing Chinese translation: ' + name + ':' + key
    );
    assert.equal(typeof zh[key], 'string', name + ':' + key);
    assert.ok(zh[key].trim(), 'Empty Chinese translation: ' + name + ':' + key);
    assert.deepEqual(
      placeholders(zh[key]),
      placeholders(text),
      'Interpolation mismatch: ' + name + ':' + key
    );
    count++;
  }
}
console.log(
  'Chinese interface valid; ' +
    count +
    ' reference keys checked; no missing Chinese labels.'
);
