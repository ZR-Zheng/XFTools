import fs from 'node:fs';
import path from 'node:path';
// The catalog only needs tool metadata. Load options, examples and long help
// with the individual tool rather than shipping every translation on the homepage.
const keys = new Set();
function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) scan(file);
    else if (
      /\.tsx?$/.test(file) &&
      (/meta\.tsx?$/.test(file) || file.includes(`${path.sep}data${path.sep}`))
    ) {
      for (const match of fs
        .readFileSync(file, 'utf8')
        .matchAll(/['"]([a-z]+):([\w.-]+)['"]/g))
        keys.add(`${match[1]}:${match[2]}`);
    }
  }
}
scan('src/pages/tools');
const catalog = {};
for (const language of ['zh']) {
  const resources = {};
  for (const file of fs.readdirSync(`public/locales/${language}`)) {
    if (!['ui.json', 'image-editor.json', 'translation.json'].includes(file))
      resources[file.replace('.json', '')] = JSON.parse(
        fs.readFileSync(`public/locales/${language}/${file}`, 'utf8')
      );
  }
  catalog[language] = Object.fromEntries(
    Object.keys(resources).map((namespace) => [namespace, {}])
  );
  for (const key of [...keys].sort()) {
    const [namespace, name] = key.split(':');
    if (!resources[namespace]) continue;
    const parts = name.split('.');
    const value = parts.reduce(
      (current, part) => current?.[part],
      resources[namespace]
    );
    if (typeof value !== 'string') continue;
    let target = catalog[language][namespace];
    for (const part of parts.slice(0, -1)) target = target[part] ||= {};
    target[parts.at(-1)] = value;
  }
}
fs.writeFileSync(
  'src/i18n/catalog.generated.json',
  JSON.stringify(catalog, null, 2) + '\n'
);
console.log(
  `Catalog metadata: ${keys.size} keys; tool options load on demand.`
);
