import { useTranslation } from 'react-i18next';
import { LANGUAGE_KEY } from '../i18n';
import { safeGetStorage } from '../lib/storage';

/**
 * Minimalist text switch for language selection (CZ / EN).
 * Active language: white, inactive: muted gray. Fits dark theme sidebar.
 */
export function LanguageSelector() {
  const { i18n, t } = useTranslation();
  const currentLang = i18n.language?.split('-')[0] ?? 'en';
  const isCs = currentLang === 'cs';

  const setLang = (lang: 'en' | 'cs') => {
    if (lang === currentLang) return;
    i18n.changeLanguage(lang);
    try {
      safeGetStorage('local').setItem(LANGUAGE_KEY, lang);
    } catch {
      // Storage unavailable – i18n change still applies for session
    }
  };

  return (
    <div
      role="group"
      aria-label="Language"
      className="flex flex-col gap-1"
    >
      <span className="text-xs font-medium text-nokturo-500 dark:text-nokturo-400">
        {t('common.language')}
      </span>
      <div className="flex items-center gap-1 text-sm">
      <button
        type="button"
        onClick={() => setLang('cs')}
        className={`px-1.5 py-0.5 rounded-[4px] transition-colors ${
          isCs
            ? 'text-nokturo-900 dark:text-white font-medium'
            : 'text-nokturo-500 dark:text-nokturo-500 hover:text-nokturo-600 dark:hover:text-nokturo-400'
        }`}
        title="Čeština"
      >
        CZ
      </button>
      <span className="text-nokturo-500 dark:text-nokturo-500 select-none" aria-hidden>
        /
      </span>
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`px-1.5 py-0.5 rounded-[4px] transition-colors ${
          !isCs
            ? 'text-nokturo-900 dark:text-white font-medium'
            : 'text-nokturo-500 dark:text-nokturo-500 hover:text-nokturo-600 dark:hover:text-nokturo-400'
        }`}
        title="English"
      >
        EN
      </button>
      </div>
    </div>
  );
}
