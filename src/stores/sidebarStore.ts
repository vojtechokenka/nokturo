import { create } from 'zustand';

interface SidebarState {
  mobileOpen: boolean;
  collapsed: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  toggleCollapsed: () => void;
  setCollapsed: (v: boolean) => void;
}

const COLLAPSED_KEY = 'nokturo-sidebar-collapsed';

export const useSidebarStore = create<SidebarState>((set) => ({
  mobileOpen: false,
  collapsed: localStorage.getItem(COLLAPSED_KEY) === 'true',
  open: () => set({ mobileOpen: true }),
  close: () => set({ mobileOpen: false }),
  toggle: () => set((s) => ({ mobileOpen: !s.mobileOpen })),
  toggleCollapsed: () =>
    set((s) => {
      const next = !s.collapsed;
      localStorage.setItem(COLLAPSED_KEY, String(next));
      return { collapsed: next };
    }),
  setCollapsed: (v: boolean) => {
    localStorage.setItem(COLLAPSED_KEY, String(v));
    return set({ collapsed: v });
  },
}));
