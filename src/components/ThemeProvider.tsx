import { useEffect } from 'react';
import { useThemeStore, Theme } from '../stores/themeStore';

function applyFavicon(theme: Theme) {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (link) link.href = theme === 'dark' ? '/icon_32_dark.png' : '/icon_32_light.png';
}

function notifyElectron(theme: Theme) {
  const api = (window as any).electronAPI;
  if (api?.setThemeIcon) api.setThemeIcon(theme);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const apply = () => {
      const theme = useThemeStore.getState().theme;
      document.documentElement.classList.toggle('dark', theme === 'dark');
      applyFavicon(theme);
      notifyElectron(theme);
    };
    apply();
    const unsub = useThemeStore.subscribe(apply);
    return unsub;
  }, []);

  return <>{children}</>;
}
