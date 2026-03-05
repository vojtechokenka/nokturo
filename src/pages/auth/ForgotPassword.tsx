import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { LanguageToggle } from '../../components/LanguageToggle';
import { MaterialIcon } from '../../components/icons/MaterialIcon';
import { INPUT_CLASS } from '../../lib/inputStyles';
import { NokturoLogo } from '../../components/NokturoLogo';
import { isElectron } from '../../utils/platform';

export default function ForgotPassword() {
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo:
            import.meta.env.VITE_REDIRECT_URL ||
            (isElectron()
              ? window.location.origin + '/#/auth/callback'
              : window.location.origin + '/app/auth/callback'),
        }
      );

      if (resetError) {
        // Show the specific Supabase error message, fall back to generic translation
        setError(resetError.message || t('auth.resetEmailError'));
      } else {
        setSent(true);
      }
    } catch (err) {
      // Handle unexpected errors (e.g. network failure)
      setError(
        err instanceof Error
          ? err.message
          : t('auth.resetEmailError')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-nokturo-50 flex items-center justify-center p-4">
      {/* Language toggle – top right */}
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>

      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="flex justify-center mb-10">
          <NokturoLogo className="h-10 w-auto text-nokturo-900 dark:text-nokturo-100" />
        </div>

        {/* Card */}
        <div className="bg-white border border-nokturo-200 rounded-xl p-8 ">
          {sent ? (
            /* Success state */
            <div className="text-center">
              <MaterialIcon name="check_circle" size={48} className="text-green-fg mx-auto mb-4 shrink-0" />
              <h2 className="text-heading-4 font-extralight text-nokturo-900 mb-2">
                {t('auth.resetEmailSent')}
              </h2>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm text-nokturo-500 hover:text-nokturo-800 transition-colors mt-6"
              >
                <MaterialIcon name="arrow_back" size={16} className="shrink-0" />
                {t('auth.backToLogin')}
              </Link>
            </div>
          ) : (
            /* Form state */
            <>
              <h2 className="text-heading-4 font-extralight text-nokturo-900 mb-1">
                {t('auth.forgotPasswordTitle')}
              </h2>
              <p className="text-nokturo-500 text-sm mb-6">
                {t('auth.forgotPasswordDescription')}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-sm text-nokturo-700 mb-1.5">
                    {t('auth.email')}
                  </label>
                  <div className="relative">
                    <MaterialIcon name="mail" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-nokturo-500 shrink-0" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      className={`${INPUT_CLASS} pl-10`}
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                {/* Error message */}
                {error && (
                  <div className="text-red dark:text-red-fg text-sm bg-red/10 dark:bg-red/20 rounded-lg px-4 py-2.5">
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-nokturo-900 text-white font-medium rounded-lg py-2.5 hover:bg-nokturo-900/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <MaterialIcon name="progress_activity" size={16} className="animate-spin shrink-0" />
                      {t('auth.sendingResetLink')}
                    </>
                  ) : (
                    t('auth.sendResetLink')
                  )}
                </button>
              </form>

              {/* Back to login */}
              <div className="mt-6 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm text-nokturo-500 hover:text-nokturo-800 transition-colors"
                >
                  <MaterialIcon name="arrow_back" size={16} className="shrink-0" />
                  {t('auth.backToLogin')}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
