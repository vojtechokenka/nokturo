import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { INPUT_CLASS } from '../../lib/inputStyles';
import { useAuthStore } from '../../stores/authStore';
import { LanguageToggle } from '../../components/LanguageToggle';
import { Mail, Lock, Loader2 } from 'lucide-react';

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
      <div className="min-h-screen bg-nokturo-50 dark:bg-nokturo-900 flex items-center justify-center">
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

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: {
        data: { persistent: rememberMe },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    // Bez window.location.reload() - nech App.tsx zpracovat přes onAuthStateChange
  };

  return (
    <div className="min-h-screen bg-nokturo-50 dark:bg-nokturo-900 flex items-center justify-center p-4">
      {/* Language toggle – top right */}
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>

      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="flex justify-center mb-10">
          <svg
            className="text-nokturo-900 dark:text-nokturo-100"
            width="190"
            height="40"
            viewBox="0 0 190 40"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M156.459 40C149.103 40 144.066 34.7607 144.066 26.2972C144.066 17.9345 149.305 12.3929 156.559 12.3929C163.915 12.3929 168.952 17.6322 168.952 26.0957C168.952 34.4584 163.713 40 156.459 40ZM156.559 38.6902C161.194 38.6902 163.31 33.6524 163.31 26.1965C163.31 19.0428 161.093 13.7028 156.459 13.7028C151.824 13.7028 149.708 18.7405 149.708 26.1965C149.708 33.3501 151.925 38.6902 156.559 38.6902Z" />
            <path d="M142.234 12.3929C142.838 12.3929 143.544 12.4937 144.249 12.796L143.04 18.0353H142.536C141.327 17.0277 139.866 16.6247 138.859 16.6247C137.649 16.6247 136.541 17.1788 135.282 18.7909V33.8539C135.282 37.0781 135.433 38.7909 137.498 38.7909V39.3955H127.826V38.7909C129.891 38.7909 130.042 37.0781 130.042 33.8539V19.8489C130.042 16.6247 129.186 15.7179 127.473 15.1133V14.5088L134.879 12.4937H135.282V17.1285C137.398 14.2569 139.715 12.3929 142.234 12.3929Z" />
            <path d="M123.692 12.4937V32.6448C123.692 35.869 124.548 37.2795 126.261 37.8841V38.4886L119.863 39.9999H119.46L118.553 35.5667C115.934 38.0856 112.558 39.9999 109.284 39.9999C105.253 39.9999 102.835 37.1788 102.835 32.141V18.7405C102.835 15.5163 101.878 14.3073 100.165 13.7027V13.0982L107.672 12.4937H108.075V30.6297C108.075 34.1561 108.881 36.5743 112.457 36.5743C114.271 36.5743 116.538 35.6675 118.452 34.2569V18.7405C118.452 15.5163 117.495 14.3073 115.782 13.7027V13.0982L123.289 12.4937H123.692Z" />
            <path d="M99.7162 34.9622L100.472 35.7682C98.1042 38.3878 94.9807 39.9999 92.1596 39.9999C88.2805 39.9999 86.0639 37.9344 86.0639 33.3501V15.2141H83.4442V14.005L84.1495 13.7027C87.0714 12.4433 88.8346 10.2266 90.6986 6.04529H91.3032V12.9974H100.119L99.3636 15.2141H91.3032V32.7455C91.3032 35.5667 92.613 37.0276 95.0815 37.0276C96.8951 37.0276 98.5072 35.9697 99.7162 34.9622Z" />
            <path d="M66.7479 0V33.8539C66.7479 37.0781 66.899 38.7909 68.9645 38.7909V39.3955H59.292V38.7909C61.3575 38.7909 61.5086 37.0781 61.5086 33.8539V6.95214C61.5086 3.72796 60.6522 2.82116 58.9393 2.21663V1.61209L66.3449 0H66.7479ZM73.8512 21.3098L72.5413 22.6196C78.9897 33.6524 82.4154 38.3879 83.9771 38.7909V39.3955C82.2139 39.597 80.9041 39.597 79.7958 39.597C76.0678 39.597 74.6068 36.7758 68.0577 25.2897L72.6925 20.3526C74.758 18.1864 75.967 16.7758 75.967 15.3652C75.967 14.3577 75.2114 13.7028 74.2038 13.602V12.9975H83.3726V13.602C81.6597 13.9043 78.1837 16.9773 73.8512 21.3098Z" />
            <path d="M44.7811 40C37.426 40 32.3882 34.7607 32.3882 26.2972C32.3882 17.9345 37.6275 12.3929 44.8819 12.3929C52.237 12.3929 57.2748 17.6322 57.2748 26.0957C57.2748 34.4584 52.0355 40 44.7811 40ZM44.8819 38.6902C49.5166 38.6902 51.6325 33.6524 51.6325 26.1965C51.6325 19.0428 49.4159 13.7028 44.7811 13.7028C40.1464 13.7028 38.0305 18.7405 38.0305 26.1965C38.0305 33.3501 40.2471 38.6902 44.8819 38.6902Z" />
            <path d="M22.0655 3.32487V2.72034H31.5365V3.32487C28.6146 3.32487 28.1108 7.15358 28.1108 12.5944V39.9999H27.1033L5.84383 7.85887V29.6221C5.84383 34.8614 6.85138 38.7909 9.97481 38.7909V39.3954H0V38.7909C2.92191 38.7909 4.13098 34.8614 4.13098 29.6221V8.86643C4.13098 5.23923 2.21662 3.72789 0 3.32487V2.72034H9.06801L26.398 29.2191V12.5944C26.398 7.15358 25.3904 3.32487 22.0655 3.32487Z" />
            <path d="M182.452 0C183.919 0 185.219 0.317073 186.35 0.951219C187.489 1.58537 188.374 2.47155 189.006 3.60976C189.637 4.74797 189.952 6.04878 189.952 7.5122C189.952 8.97561 189.637 10.2764 189.006 11.4146C188.374 12.5447 187.489 13.4268 186.35 14.061C185.219 14.687 183.919 15 182.452 15C180.985 15 179.682 14.687 178.542 14.061C177.411 13.4268 176.53 12.5447 175.899 11.4146C175.268 10.2764 174.952 8.97561 174.952 7.5122C174.952 6.04878 175.268 4.74797 175.899 3.60976C176.53 2.47155 177.411 1.58537 178.542 0.951219C179.682 0.317073 180.985 0 182.452 0ZM182.452 14.0366C183.747 14.0366 184.883 13.7683 185.858 13.2317C186.842 12.6951 187.6 11.935 188.133 10.9512C188.674 9.95935 188.944 8.81301 188.944 7.5122C188.944 6.20325 188.674 5.05691 188.133 4.07317C187.6 3.0813 186.842 2.31707 185.858 1.78049C184.883 1.23577 183.747 0.963415 182.452 0.963415C181.157 0.963415 180.018 1.23577 179.034 1.78049C178.051 2.31707 177.292 3.0813 176.76 4.07317C176.227 5.05691 175.96 6.20325 175.96 7.5122C175.96 8.82114 176.227 9.96748 176.76 10.9512C177.292 11.935 178.051 12.6951 179.034 13.2317C180.018 13.7683 181.157 14.0366 182.452 14.0366ZM185.317 6.0122C185.317 7.10163 184.772 7.79675 183.682 8.09756L185.637 10.9512H184.518L182.649 8.2561C182.575 8.26423 182.456 8.26829 182.292 8.26829H180.866L180.854 10.9512H179.87V3.73171H182.292C183.284 3.73171 184.034 3.93089 184.542 4.32927C185.059 4.71951 185.317 5.28049 185.317 6.0122ZM182.465 7.39024C183.112 7.39024 183.588 7.28049 183.891 7.06097C184.194 6.83333 184.346 6.48374 184.346 6.0122C184.346 5.07724 183.719 4.60976 182.465 4.60976H180.866V7.39024H182.465Z" />
          </svg>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-nokturo-800 border border-nokturo-200 dark:border-nokturo-700 rounded-xl p-8 shadow-sm">
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-300 mb-1.5">
                {t('auth.email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nokturo-500 dark:text-nokturo-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className={`${INPUT_CLASS} pl-10 py-2.5`}
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-300 mb-1.5">
                {t('auth.password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nokturo-500 dark:text-nokturo-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className={`${INPUT_CLASS} pl-10 py-2.5`}
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
                  className="rounded border-nokturo-300 dark:border-nokturo-600 text-nokturo-600 focus:ring-nokturo-500"
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
              <div className="text-red-700 dark:text-red-300 text-sm bg-red-50 dark:bg-red-900/30 rounded-lg px-4 py-2.5">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-nokturo-900 dark:bg-nokturo-100 text-white dark:text-nokturo-900 font-medium rounded-lg py-2.5 hover:bg-nokturo-800 dark:hover:bg-nokturo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
        </div>
      </div>
    </div>
  );
}
