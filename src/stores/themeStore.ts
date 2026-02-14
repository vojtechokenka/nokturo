import { create } from 'zustand';
import { safeGetStorage } from '../lib/storage';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'nokturo-theme';

function loadTheme(): Theme {
  try {
    const s = safeGetStorage('local').getItem(THEME_KEY);
    if (s === 'dark' || s === 'light') return s;
    const j = s ? JSON.parse(s) : null;
    if (j?.state?.theme === 'dark') return 'dark';
  } catch {
    /* ignore */
  }
  return 'light';
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: loadTheme(),
  setTheme: (theme) => {
    try {
      safeGetStorage('local').setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
    set({ theme });
  },
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'light' ? 'dark' : 'light';
      try {
        safeGetStorage('local').setItem(THEME_KEY, next);
      } catch {
        /* ignore */
      }
      return { theme: next };
    }),
}));
