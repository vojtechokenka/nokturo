import { create } from 'zustand';

interface SleepModeState {
  isActive: boolean;
  reason?: string;
  activate: (reason?: string) => void;
  deactivate: () => void;
}

export const useSleepModeStore = create<SleepModeState>((set) => ({
  isActive: false,
  reason: undefined,
  activate: (reason) => set({ isActive: true, reason }),
  deactivate: () => set({ isActive: false, reason: undefined }),
}));
