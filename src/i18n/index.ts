import i18n, { Namespace, ParseKeys } from 'i18next';
import { initReactI18next } from 'react-i18next';

export const validNamespaces = [
  'string',
  'number',
  'video',
  'list',
  'json',
  'time',
  'csv',
  'pdf',
  'audio',
  'xml',
  'translation',
  'image',
  'converters'
] as const satisfies readonly Namespace[];
export type I18nNamespaces = (typeof validNamespaces)[number];
export type FullI18nKey = {
  [K in I18nNamespaces]: `${K}:${ParseKeys<K>}`;
}[I18nNamespaces];

const files = import.meta.glob('../../public/locales/{zh,en}/*.json', {
  eager: true,
  import: 'default'
});
const resources: Record<string, Record<string, object>> = { zh: {}, en: {} };
for (const [path, content] of Object.entries(files)) {
  const [, language, namespace] = path.match(/locales\/(zh|en)\/(.+)\.json$/)!;
  resources[language][namespace] = content as object;
}
let language = 'zh';
try {
  language = localStorage.getItem('lang') === 'en' ? 'en' : 'zh';
} catch {
  /* Storage may be disabled. */
}

i18n.use(initReactI18next).init({
  resources,
  lng: language,
  supportedLngs: ['zh', 'en'],
  fallbackLng: 'en',
  defaultNS: 'translation',
  ns: [...validNamespaces],
  interpolation: { escapeValue: false }
});
function syncLanguage(language: string) {
  document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
  try {
    localStorage.setItem('lang', language);
  } catch {
    /* Keep the in-memory preference. */
  }
}
syncLanguage(language);
i18n.on('languageChanged', syncLanguage);
export default i18n;
