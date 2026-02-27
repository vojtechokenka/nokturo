import { useEffect, useState, useCallback } from 'react';
import { RouterProvider } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { router } from './router';
import { useAuthStore } from './stores/authStore';
import { useSleepModeStore } from './stores/sleepModeStore';
import { useThemeStore } from './stores/themeStore';
import { useToastStore } from './stores/toastStore';
import { SleepMode } from './components/SleepMode';
import i18n, { LANGUAGE_KEY } from './i18n';
import { safeGetStorage } from './lib/storage';
import type { Role } from './lib/rbac';

const VALID_ROLES: Role[] = ['founder', 'engineer', 'viewer', 'client', 'host'];

function resolveRole(raw: unknown): Role {
  const s = typeof raw === 'string' ? raw.toLowerCase() : '';
  return VALID_ROLES.includes(s as Role) ? (s as Role) : 'client';
}

function buildMinimalUser(session: { user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } }) {
  const role = resolveRole(session.user.user_metadata?.role);
  const fullName = (session.user.user_metadata?.full_name as string | undefined) ?? '';
  // Try to extract firstName/lastName from full_name metadata
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts.length > 0 ? parts[0] : undefined;
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined;
  const displayName = fullName || session.user.email || '';
  return {
    id: session.user.id,
    email: session.user.email ?? '',
    name: displayName,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    role,
    avatarUrl: (session.user.user_metadata?.avatar_url as string | undefined) ?? undefined,
  };
}

/** Apply language & theme from DB profile to frontend stores + localStorage */
function applyProfilePreferences(language: 'en' | 'cs', theme: 'light' | 'dark') {
  // Language
  if (i18n.language !== language) {
    i18n.changeLanguage(language);
  }
  try {
    safeGetStorage('local').setItem(LANGUAGE_KEY, language);
  } catch { /* ignore */ }

  // Theme
  const currentTheme = useThemeStore.getState().theme;
  if (currentTheme !== theme) {
    useThemeStore.getState().setTheme(theme);
  }
}

const PROFILE_FETCH_TIMEOUT_MS = 30_000; // temporarily 30s to debug timeout

/** Guard: prevent multiple simultaneous profile fetches (e.g. from onAuthStateChange loop) */
let profileFetchInProgress = false;

/** Returns user or null if fetch was skipped (another fetch in progress). Caller should not setUser when null. */
async function fetchUserProfileOnce(
  session: { user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } }
): Promise<Awaited<ReturnType<typeof buildUserFromSession>> | null> {
  if (profileFetchInProgress) return null;
  profileFetchInProgress = true;
  try {
    return await buildUserFromSession(session, () => useAuthStore.getState().user);
  } finally {
    profileFetchInProgress = false;
  }
}

async function buildUserFromSession(
  session: { user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } },
  /** When profile fetch fails, preserve role/avatar/name from existing user (e.g. during refreshSession, tab return) */
  getExistingUser?: () => { id: string; role?: string; avatarUrl?: string; name?: string; firstName?: string; lastName?: string } | null
) {
  const fetchProfile = () =>
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

  let profile: Record<string, unknown> | null = null;
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Profiles fetch timeout')), PROFILE_FETCH_TIMEOUT_MS)
    );
    const { data, error } = await Promise.race([fetchProfile(), timeoutPromise]) as { data: typeof profile; error: { message?: string; code?: string } };
    console.warn('[Profile fetch] data:', data, 'error:', error);
    if (error) throw error;
    profile = data;
  } catch (err) {
    const e = err as { message?: string; code?: string };
    console.warn('[Profile fetch] message:', e?.message, 'code:', e?.code);
    useToastStore.getState().addToast('Could not load profile. Some features may be limited.', 'error');
    const minimal = buildMinimalUser(session);
    const existing = getExistingUser?.();
    if (existing?.id === session.user.id) {
      if (existing.role && minimal.role === 'client') {
        minimal.role = existing.role as import('./lib/rbac').Role;
      }
      if (existing.avatarUrl) minimal.avatarUrl = existing.avatarUrl;
      if (existing.name) minimal.name = existing.name;
      if (existing.firstName) minimal.firstName = existing.firstName;
      if (existing.lastName) minimal.lastName = existing.lastName;
    }
    return minimal;
  }

  const role = resolveRole(profile?.role ?? session.user.user_metadata?.role);
  const firstName = profile?.first_name as string | undefined;
  const lastName = profile?.last_name as string | undefined;
  const fullName = profile?.full_name as string | undefined;
  const nameParts = [firstName, lastName].filter(Boolean).join(' ');
  const displayName = nameParts || fullName || session.user.email || '';

  const language = (profile?.language === 'cs' ? 'cs' : 'en') as 'en' | 'cs';
  const theme = (profile?.theme === 'dark' ? 'dark' : 'light') as 'light' | 'dark';

  applyProfilePreferences(language, theme);

  return {
    id: session.user.id,
    email: session.user.email ?? '',
    name: displayName,
    firstName,
    lastName,
    role,
    avatarUrl: profile?.avatar_url as string | undefined,
    language,
    theme,
  };
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const setAuthLoading = useAuthStore((s) => s.setLoading);
  const setInitialized = useAuthStore((s) => s.setInitialized);

  const sleepActive = useSleepModeStore((s) => s.isActive);
  const sleepReason = useSleepModeStore((s) => s.reason);
  const deactivateSleep = useSleepModeStore((s) => s.deactivate);

  // Wake-up handler: refresh session + profile, then dismiss overlay
  const wakeUp = useCallback(async () => {
    console.log('🌅 Waking up application...');

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();

      if (sessionError || !session) {
        console.error('Session refresh failed:', sessionError);
        await supabase.auth.signOut();
        deactivateSleep();
        setUser(null, undefined);
        return;
      }

      const freshUser = await buildUserFromSession(session, () => useAuthStore.getState().user);
      setUser(freshUser, session);

      // Short pause for a smooth transition
      await new Promise((r) => setTimeout(r, 400));

      deactivateSleep();
      console.log('✅ Application awake!');
    } catch (error) {
      console.error('Wake up failed:', error);
      deactivateSleep();
    }
  }, [deactivateSleep, setUser]);

  useEffect(() => {
    // Safety: pokud se nic nedokončí do 8s (např. fetch visí), odblokuj
    const safetyTimer = setTimeout(() => {
      setAuthLoading(false);
      setLoading(false);
      setInitialized(true);
    }, 8000);

    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        console.log('[Auth] Startup getSession:', session?.user?.id ?? 'null', session?.access_token ? 'HAS TOKEN' : 'NO TOKEN');
        try {
          // Fast path: session already valid on startup → fetch profile immediately
          if (session?.access_token && session?.user) {
            const user = await fetchUserProfileOnce(session);
            if (user) setUser(user, session);
          } else {
            // No token yet: rely on onAuthStateChange when SIGNED_IN/TOKEN_REFRESHED fires
            setUser(null, session);
          }
        } catch {
          setUser(null, session);
        }
        setAuthLoading(false);
        setLoading(false);
        setInitialized(true);
      })
      .catch(() => {
        setUser(null, undefined);
        setAuthLoading(false);
        setLoading(false);
        setInitialized(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Sign-out: clear user and mark ready
      if (!session?.user) {
        setUser(null, session);
        setAuthLoading(false);
        setLoading(false);
        setInitialized(true);
        return;
      }
      // Event-driven: only fetch profile when we have a valid token from sign-in or refresh
      if (event !== 'SIGNED_IN' && event !== 'TOKEN_REFRESHED') return;
      if (!session.access_token) return;

      try {
        const existingUser = useAuthStore.getState().user;
        // On token refresh, if we already have good user data, keep it (prevents avatar reset)
        if (event === 'TOKEN_REFRESHED' && existingUser && existingUser.id === session.user.id) {
          setUser(existingUser, session);
        } else {
          const user = await fetchUserProfileOnce(session);
          if (user) setUser(user, session);
        }
      } catch {
        const existingUser = useAuthStore.getState().user;
        if (existingUser && existingUser.id === session.user.id) {
          setUser(existingUser, session);
        } else {
          setUser(null, session);
        }
      }
      setAuthLoading(false);
      setLoading(false);
      setInitialized(true);
    });

    return () => {
      clearTimeout(safetyTimer);
      subscription?.unsubscribe();
    };
  }, [setUser, setAuthLoading, setInitialized]);

  // NOTE: Aggressive session health checks and window focus handlers were removed.
  // Supabase autoRefreshToken handles token lifecycle automatically.
  // The removed checks caused false session-expired triggers on alt-tab.

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-nokturo-50 dark:bg-nokturo-900 text-nokturo-900 dark:text-nokturo-100">Loading...</div>;
  }

  return (
    <>
      <RouterProvider router={router} />
      {sleepActive && <SleepMode onWakeUp={wakeUp} reason={sleepReason} />}
    </>
  );
}
