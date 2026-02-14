import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { LanguageToggle } from '../../components/LanguageToggle';
import { Lock, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { PasswordInput } from '../../components/PasswordInput';
import { INPUT_CLASS } from '../../lib/inputStyles';

export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }

    setSubmitting(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(t('auth.passwordResetError'));
      setSubmitting(false);
    } else {
      setSuccess(true);
      setSubmitting(false);
      // Redirect to login after a short delay (no auto signOut – user must click Logout)
      setTimeout(() => navigate('/login'), 3000);
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
        <div className="text-center mb-10">
          <h1 className="font-body text-heading-2 font-extralight text-nokturo-900 tracking-tight">Nokturo</h1>
          <p className="text-nokturo-500 mt-2 text-sm">{t('app.tagline')}</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-nokturo-200 rounded-xl p-8 ">
          {success ? (
            /* Success state */
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <h2 className="font-body text-heading-4 font-extralight text-nokturo-900 mb-2">
                {t('auth.passwordResetSuccess')}
              </h2>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm text-nokturo-500 hover:text-nokturo-800 transition-colors mt-6"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('auth.backToLogin')}
              </Link>
            </div>
          ) : (
            /* Form state */
            <>
              <h2 className="font-body text-heading-4 font-extralight text-nokturo-900 mb-1">
                {t('auth.resetPasswordTitle')}
              </h2>
              <p className="text-nokturo-500 text-sm mb-6">
                {t('auth.resetPasswordDescription')}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New Password */}
                <div>
                  <label className="block text-sm text-nokturo-700 mb-1.5">
                    {t('auth.newPassword')}
                  </label>
                  <PasswordInput
                    leftIcon={<Lock className="w-4 h-4" />}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                    inputClassName={INPUT_CLASS}
                    placeholder="••••••••"
                  />
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm text-nokturo-700 mb-1.5">
                    {t('auth.confirmPassword')}
                  </label>
                  <PasswordInput
                    leftIcon={<Lock className="w-4 h-4" />}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    inputClassName={INPUT_CLASS}
                    placeholder="••••••••"
                  />
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
                  disabled={submitting}
                  className="w-full bg-nokturo-900 text-white font-medium rounded-lg py-2.5 hover:bg-nokturo-900/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('auth.resettingPassword')}
                    </>
                  ) : (
                    t('auth.resetPassword')
                  )}
                </button>
              </form>

              {/* Back to login */}
              <div className="mt-6 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm text-nokturo-500 hover:text-nokturo-800 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
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
