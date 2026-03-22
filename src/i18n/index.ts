import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './en.json';
import cs from './cs.json';

const LANGUAGE_KEY = 'nokturo-language';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      cs: { translation: cs },
    },
    lng: 'en',
    fallbackLng: 'en',
    supportedLngs: ['en', 'cs'],
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: LANGUAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false, // React already handles XSS
    },
  });

if (typeof document !== 'undefined') {
  const syncDocumentLanguage = (lng: string) => {
    if (lng === 'en' || lng === 'cs') {
      document.documentElement.lang = lng;
    }
  };

  syncDocumentLanguage(i18n.resolvedLanguage || i18n.language || 'en');
  i18n.on('languageChanged', syncDocumentLanguage);
}

export { LANGUAGE_KEY };
export default i18n;
