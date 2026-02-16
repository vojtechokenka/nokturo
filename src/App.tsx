import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { router } from './router';
import { useAuthStore } from './stores/authStore';
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

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-nokturo-50 dark:bg-nokturo-900 text-nokturo-900 dark:text-nokturo-100">Loading...</div>;
  }

  return <RouterProvider router={router} />;
}
