import { useEffect, useState, useCallback } from 'react';
import { RouterProvider } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { router } from './router';
import { useAuthStore } from './stores/authStore';
import { useSleepModeStore } from './stores/sleepModeStore';
import { SleepMode } from './components/SleepMode';
import type { Role } from './lib/rbac';

const VALID_ROLES: Role[] = ['founder', 'engineer', 'viewer', 'client'];

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

async function buildUserFromSession(
  session: { user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } },
  /** When profile fetch fails, preserve role from existing user to avoid transient Founder→Client downgrade (e.g. during refreshSession) */
  getExistingUser?: () => { id: string; role: string } | null
) {
  const fetchProfile = () =>
    supabase
      .from('profiles')
      .select('role, first_name, last_name, full_name, avatar_url')
      .eq('id', session.user.id)
      .maybeSingle();

  let profile: { role?: string; first_name?: string; last_name?: string; full_name?: string; avatar_url?: string } | null = null;

  // Try up to 2 times with short timeouts (3s each)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1000));
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Profiles fetch timeout')), 3000)
      );
      const { data, error } = await Promise.race([fetchProfile(), timeoutPromise]) as { data: typeof profile; error: unknown };
      if (error) throw error;
      profile = data;
      break; // success
    } catch (err) {
      console.warn(`⚠️ Profile fetch attempt ${attempt + 1} failed:`, err);
      if (attempt === 1) {
        // Both attempts failed, use minimal user
        const minimal = buildMinimalUser(session);
        const existing = getExistingUser?.();
        if (existing?.id === session.user.id && existing.role && minimal.role === 'client') {
          minimal.role = existing.role as import('./lib/rbac').Role;
        }
        return minimal;
      }
    }
  }

  const role = resolveRole(profile?.role ?? session.user.user_metadata?.role);
  const firstName = profile?.first_name as string | undefined;
  const lastName = profile?.last_name as string | undefined;
  const fullName = profile?.full_name as string | undefined;
  const nameParts = [firstName, lastName].filter(Boolean).join(' ');
  const displayName = nameParts || fullName || session.user.email || '';

  return {
    id: session.user.id,
    email: session.user.email ?? '',
    name: displayName,
    firstName,
    lastName,
    role,
    avatarUrl: profile?.avatar_url as string | undefined,
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
  const activateSleep = useSleepModeStore((s) => s.activate);
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
        try {
          if (session?.user) {
            const user = await buildUserFromSession(session, () => useAuthStore.getState().user);
            setUser(user, session);
          } else {
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
      try {
        if (session?.user) {
          const existingUser = useAuthStore.getState().user;
          // On token refresh, if we already have good user data, keep it
          // Only rebuild if user ID changed or we have no data
          if (event === 'TOKEN_REFRESHED' && existingUser && existingUser.id === session.user.id) {
            // Silently update session without re-fetching profile
            // This prevents avatar/name reset when profile fetch times out
            setUser(existingUser, session);
          } else {
            const user = await buildUserFromSession(session, () => useAuthStore.getState().user);
            setUser(user, session);
          }
        } else {
          setUser(null, session);
        }
      } catch {
        // On error, preserve existing user if same session
        const existingUser = useAuthStore.getState().user;
        if (existingUser && session?.user && existingUser.id === session.user.id) {
          setUser(existingUser, session);
        } else {
          setUser(null, session);
        }
      }
      setAuthLoading(false);
      setLoading(false);
    });

    return () => {
      clearTimeout(safetyTimer);
      subscription?.unsubscribe();
    };
  }, [setUser, setAuthLoading, setInitialized]);

  // Session health check – every 30 s while logged in
  useEffect(() => {
    if (!user) return;

    const checkSessionHealth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          console.warn('⚠️ Session health check failed');
          activateSleep('Your session expired');
          return;
        }

        // Warn when session expires in < 5 min
        const timeLeft = (session.expires_at ?? 0) - Math.floor(Date.now() / 1000);
        if (timeLeft > 0 && timeLeft < 300) {
          console.warn('⚠️ Session expiring soon, refreshing…');
          const { error: refreshErr } = await supabase.auth.refreshSession();
          if (refreshErr) {
            activateSleep('Your session is expiring soon');
          }
        }
      } catch {
        console.error('Session health check error');
        activateSleep('Connection lost');
      }
    };

    const interval = setInterval(checkSessionHealth, 30_000);
    return () => clearInterval(interval);
  }, [user, activateSleep]);

  // Re-check session when window regains focus
  useEffect(() => {
    if (!user) return;

    const handleFocus = async () => {
      console.log('🔍 Window focused, checking session…');
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
          console.warn('⚠️ Session lost while inactive');
          activateSleep('Session expired while inactive');
        }
      } catch {
        console.error('Focus check error');
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user, activateSleep]);

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
