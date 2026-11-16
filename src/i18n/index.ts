import i18n, { Namespace, ParseKeys } from 'i18next';
import { initReactI18next } from 'react-i18next';
import catalog from './catalog.generated.json';
import zhCommon from '../../public/locales/zh/translation.json';
import enCommon from '../../public/locales/en/translation.json';
import { registerInterfaceCopy } from './interface-copy';

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
  zh: { ...catalog.zh, translation: zhCommon }
};
registerInterfaceCopy(enCommon, zhCommon);
const loaded = new Map<string, Promise<void>>();
export function ensureToolLocale(namespace: string): Promise<void> {
  if (namespace === 'translation') return Promise.resolve();
  const existing = loaded.get(namespace);
  if (existing) return existing;
  const pending = (async () => {
    const translated = files[`../../public/locales/zh/${namespace}.json`];
    const source = files[`../../public/locales/en/${namespace}.json`];
    if (!translated || !source)
      throw new Error(`Missing tool labels: ${namespace}`);
    const [data, reference] = await Promise.all([translated(), source()]);
    registerInterfaceCopy(
      reference as Record<string, unknown>,
      data as Record<string, unknown>
    );
    i18n.addResourceBundle('zh', namespace, data, true, true);
  })();
  loaded.set(namespace, pending);
  pending.catch(() => loaded.delete(namespace));
  return pending;
}
i18n.use(initReactI18next).init({
  resources,
  lng: 'zh',
  supportedLngs: ['zh'],
  fallbackLng: 'zh',
  defaultNS: 'translation',
  ns: [...validNamespaces],
  interpolation: { escapeValue: false }
});
function syncLanguage() {
  document.documentElement.lang = 'zh-CN';
  try {
    localStorage.removeItem('lang');
  } catch {
    /* Keep the in-memory preference. */
  }
}
syncLanguage();
i18n.on('languageChanged', syncLanguage);
export default i18n;
