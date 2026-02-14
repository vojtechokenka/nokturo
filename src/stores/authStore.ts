import { create } from 'zustand';
import type { Role } from '../lib/rbac';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns user id for DB inserts, or null if dev-user or invalid UUID */
export function getUserIdForDb(): string | null {
  const id = useAuthStore.getState().user?.id;
  if (!id || id === 'dev-user') return null;
  return UUID_REGEX.test(id) ? id : null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  role: Role;
  avatarUrl?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** True only after 2s from app start – no redirect until then */
  isInitialized: boolean;

  // Actions
  setUser: (user: User | null, session?: unknown) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (v: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  // Start with true – wait for Supabase init before redirecting (prevents logout on reload)
  isLoading: true,
  isInitialized: false,

  setUser: (user, _session?: unknown) => {
    set({
      user,
      isAuthenticated: !!user,
    });
  },

  setLoading: (isLoading) => set({ isLoading }),

  setInitialized: (isInitialized) => set({ isInitialized }),

  logout: () => {
    set({ user: null, isAuthenticated: false });
  },
}));
