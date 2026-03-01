import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { INPUT_CLASS } from '../../lib/inputStyles';
import { useAuthStore } from '../../stores/authStore';
import { Loader2 } from 'lucide-react';
import { LoginLogo } from '../../components/LoginLogo';
import { AppUpdateSection } from '../../components/AppUpdateSection';
import { isElectron } from '../../utils/platform';

export default function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-nokturo-50 dark:bg-black flex items-center justify-center">
        <div className="text-nokturo-500 dark:text-nokturo-400">{t('common.loading')}</div>
      </div>
    );
  }
  if (isAuthenticated) {
    return <Navigate to="/brand/strategy" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: {
        data: { persistent: rememberMe },
      },
    });

    console.warn('🔐 signIn result:', data?.user?.id ?? 'null', authError?.message ?? 'no error');

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    // Bez window.location.reload() - nech App.tsx zpracovat přes onAuthStateChange
  };

  return (
    <div className="min-h-screen bg-nokturo-50 dark:bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="flex justify-center mb-10">
          <LoginLogo className="h-10 w-auto" />
        </div>

        {/* Card */}
        <div>
          <form onSubmit={handleLogin} className="login-form space-y-4">
            {/* Email */}
            <div>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  aria-label={t('auth.email')}
                  className={`${INPUT_CLASS} h-11 border-0 focus:border-0 !bg-white/10`}
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  aria-label={t('auth.password')}
                  className={`${INPUT_CLASS} h-11 border-0 focus:border-0 !bg-white/10`}
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="checkbox-auth rounded-none border-nokturo-300 dark:border-nokturo-600 focus:ring-nokturo-500"
                />
                <span className="text-sm text-nokturo-700 dark:text-nokturo-300">
                  {t('auth.rememberMe')}
                </span>
              </label>
              <Link
                to="/forgot-password"
                className="text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 transition-colors"
              >
                {t('auth.forgotPassword')}
              </Link>
            </div>

            {/* Error message */}
            {error && (
              <div className="text-red-700 dark:text-red-300 text-sm bg-red-50 dark:bg-red-900/30 rounded-none px-4 py-2.5">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-nokturo-900 dark:bg-nokturo-100 text-white dark:text-nokturo-900 font-medium py-2.5 hover:bg-nokturo-800 dark:hover:bg-nokturo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('auth.signingIn')}
                </>
              ) : (
                t('auth.signIn')
              )}
            </button>
          </form>

          {/* App version & update (Electron only) — dostupné bez přihlášení */}
          {isElectron() && <AppUpdateSection compact />}
        </div>
      </div>
    </div>
  );
}
