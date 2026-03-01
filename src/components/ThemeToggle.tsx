import { useTranslation } from 'react-i18next';
import { LightModeIcon } from './icons/LightModeIcon';
import { DarkModeIcon } from './icons/DarkModeIcon';
import { useThemeStore, type Theme } from '../stores/themeStore';
import { useAuthStore, getUserIdForDb } from '../stores/authStore';
import { supabase } from '../lib/supabase';

interface ThemeToggleProps {
  variant?: 'light' | 'dark';
}

/**
 * Segmented control for theme selection – Light / Dark.
 * Matches LanguageToggle styling for consistency.
 */
export function ThemeToggle({ variant }: ThemeToggleProps) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const storeSetTheme = useThemeStore((s) => s.setTheme);

  const setTheme = (next: Theme) => {
    storeSetTheme(next);
    // Persist to DB profile
    const userId = getUserIdForDb();
    if (userId) {
      supabase.from('profiles').update({ theme: next }).eq('id', userId).then();
      const u = useAuthStore.getState().user;
      if (u) useAuthStore.getState().setUser({ ...u, theme: next });
    }
  };

  const isDarkVariant = variant === 'dark' || (variant !== 'light' && theme === 'dark');

  const groupClass = isDarkVariant
    ? 'inline-flex w-[177px] rounded-[6px] bg-nokturo-800 p-0.5'
    : 'inline-flex w-[177px] rounded-[6px] bg-nokturo-100 p-0.5 dark:bg-nokturo-800';

  const optionBase =
    'flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-[4px] transition-colors min-w-0';

  const optionActive = isDarkVariant
    ? 'bg-nokturo-600 text-white'
    : 'bg-white text-nokturo-900 dark:bg-nokturo-600 dark:text-white shadow-sm';

  const optionInactive = isDarkVariant
    ? 'text-nokturo-400 hover:text-nokturo-300'
    : 'text-nokturo-600 hover:text-nokturo-800 dark:text-nokturo-400 dark:hover:text-nokturo-300';

  return (
    <div
      role="group"
      aria-label={t('settings.account.theme')}
      className={groupClass}
    >
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={`${optionBase} ${theme === 'light' ? optionActive : optionInactive}`}
        title={t('settings.account.themeLight')}
      >
        <LightModeIcon className="w-4 h-4 shrink-0" />
        {t('settings.account.themeLight')}
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={`${optionBase} ${theme === 'dark' ? optionActive : optionInactive}`}
        title={t('settings.account.themeDark')}
      >
        <DarkModeIcon className="w-4 h-4 shrink-0" />
        {t('settings.account.themeDark')}
      </button>
    </div>
  );
}
