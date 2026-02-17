import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../stores/themeStore';
import { useAuthStore, getUserIdForDb } from '../stores/authStore';
import { LANGUAGE_KEY } from '../i18n';
import { safeGetStorage } from '../lib/storage';
import { supabase } from '../lib/supabase';

interface LanguageToggleProps {
  variant?: 'light' | 'dark';
}

/**
 * Segmented control for language selection – two options (English / Česky),
 * active one highlighted. Matches ThemeToggle width for consistency.
 */
export function LanguageToggle({ variant }: LanguageToggleProps) {
  const { i18n } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const currentLang = i18n.language?.split('-')[0] ?? 'en';

  const setLang = (lang: 'en' | 'cs') => {
    if (lang === currentLang) return;
    i18n.changeLanguage(lang);
    try {
      safeGetStorage('local').setItem(LANGUAGE_KEY, lang);
    } catch {
      // Storage unavailable – i18n change still applies for session
    }
    // Persist to DB profile
    const userId = getUserIdForDb();
    if (userId) {
      supabase.from('profiles').update({ language: lang }).eq('id', userId).then();
      const u = useAuthStore.getState().user;
      if (u) useAuthStore.getState().setUser({ ...u, language: lang });
    }
  };

  const isDark = variant === 'dark' || (variant !== 'light' && theme === 'dark');

  const groupClass = isDark
    ? 'inline-flex w-[177px] rounded-lg bg-nokturo-800 p-0.5'
    : 'inline-flex w-[177px] rounded-lg bg-nokturo-100 p-0.5';

  const optionBase =
    'flex-1 inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium rounded-md transition-colors min-w-0';

  const optionActive = isDark
    ? 'bg-nokturo-600 text-white '
    : 'bg-white text-nokturo-900 ';

  const optionInactive = isDark
    ? 'text-nokturo-400 hover:text-nokturo-300'
    : 'text-nokturo-600 hover:text-nokturo-800';

  return (
    <div
      role="group"
      aria-label={currentLang === 'cs' ? 'Jazyk' : 'Language'}
      className={groupClass}
    >
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`${optionBase} ${currentLang === 'en' ? optionActive : optionInactive}`}
        title="English"
      >
        English
      </button>
      <button
        type="button"
        onClick={() => setLang('cs')}
        className={`${optionBase} ${currentLang === 'cs' ? optionActive : optionInactive}`}
        title="Čeština"
      >
        Česky
      </button>
    </div>
  );
}
