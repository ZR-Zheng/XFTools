import i18n, { Namespace, ParseKeys } from 'i18next';
import { initReactI18next } from 'react-i18next';
import catalog from './catalog.generated.json';
import zhCommon from '../../public/locales/zh/translation.json';
import enCommon from '../../public/locales/en/translation.json';

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
  import: 'default'
});
const resources = {
  zh: { ...catalog.zh, translation: zhCommon },
  en: { ...catalog.en, translation: enCommon }
};
const loaded = new Map<string, Promise<void>>();
export function ensureToolLocale(namespace: string): Promise<void> {
  if (namespace === 'translation') return Promise.resolve();
  const existing = loaded.get(namespace);
  if (existing) return existing;
  const pending = Promise.all(
    ['zh', 'en'].map(async (lang) => {
      const loader = files[`../../public/locales/${lang}/${namespace}.json`];
      if (!loader) throw new Error(`Missing tool locale: ${lang}/${namespace}`);
      const data = await loader();
      i18n.addResourceBundle(lang, namespace, data, true, true);
    })
  ).then(() => {});
  loaded.set(namespace, pending);
  pending.catch(() => loaded.delete(namespace));
  return pending;
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
