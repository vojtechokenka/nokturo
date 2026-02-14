import { useEffect } from 'react';
import { useThemeStore } from '../stores/themeStore';

/**
 * Applies theme (light/dark) to document.documentElement for Tailwind dark: variants.
 * Uses subscribe() to ensure DOM stays in sync even during Zustand persist rehydration.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const apply = () => {
      const theme = useThemeStore.getState().theme;
      document.documentElement.classList.toggle('dark', theme === 'dark');
    };
    apply();
    const unsub = useThemeStore.subscribe(apply);
    return unsub;
  }, []);

  return <>{children}</>;
}
