import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';

/**
 * Handles Supabase auth redirects (e.g. password recovery links).
 *
 * Supabase appends tokens as a URL hash fragment:
 *   /auth/callback#access_token=...&type=recovery
 *
 * The Supabase JS client automatically picks up the hash and
 * establishes a session. We just need to wait for that to happen,
 * then redirect to the appropriate page.
 */
export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const authData = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'PASSWORD_RECOVERY') {
          // User clicked the password-reset link → send them to the form
          navigate('/reset-password', { replace: true });
        } else if (event === 'SIGNED_IN') {
          // Generic sign-in (e.g. magic link, OAuth) → go to the app
          navigate('/', { replace: true });
        }
      },
    );

    // Fallback: if nothing happens within 5 seconds, redirect to login
    const timeout = setTimeout(() => {
      navigate('/login', { replace: true });
    }, 5000);

    const subscription = authData?.data?.subscription;

    return () => {
      subscription?.unsubscribe?.();
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-nokturo-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-nokturo-500 animate-spin mx-auto mb-4" />
        <p className="text-nokturo-600 text-sm">Verifying…</p>
      </div>
    </div>
  );
}
