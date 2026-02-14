import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { PageShell } from '../../components/PageShell';
import { Lock, Loader2, CheckCircle, Shield, ArrowLeft } from 'lucide-react';
import { PasswordInput } from '../../components/PasswordInput';

export default function SecurityPage() {
  const { t } = useTranslation();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

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
      setError(t('auth.passwordChangeError'));
    } else {
      setSuccess(t('auth.passwordChanged'));
      setPassword('');
      setConfirmPassword('');
    }

    setSubmitting(false);
  };

  return (
    <PageShell
      titleKey="settings.security.title"
      descriptionKey="settings.security.description"
    >
      <div className="max-w-lg">
        <Link
          to="/settings/account"
          className="inline-flex items-center gap-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('settings.security.backToSettings')}
        </Link>

        {/* Change Password */}
        <div className="pt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-nokturo-200 dark:bg-nokturo-700 flex items-center justify-center">
              <Shield className="w-5 h-5 text-nokturo-600 dark:text-nokturo-400" />
            </div>
            <div>
              <h3 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100">
                {t('settings.security.changePassword')}
              </h3>
              <p className="text-nokturo-600 dark:text-nokturo-400 text-sm">
                {t('settings.security.currentPasswordNote')}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password */}
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
                {t('settings.security.newPassword')}
              </label>
              <PasswordInput
                leftIcon={<Lock className="w-4 h-4" />}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setSuccess('');
                }}
                required
                placeholder="••••••••"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
                {t('settings.security.confirmPassword')}
              </label>
              <PasswordInput
                leftIcon={<Lock className="w-4 h-4" />}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setSuccess('');
                }}
                required
                placeholder="••••••••"
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="text-red-700 dark:text-red-300 text-sm bg-red-50 dark:bg-red-900/30 rounded-lg px-4 py-2.5">
                {error}
              </div>
            )}

            {/* Success message */}
            {success && (
              <div className="text-green-700 dark:text-green-300 text-sm bg-green-50 dark:bg-green-900/30 rounded-lg px-4 py-2.5 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                {success}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="bg-nokturo-900 dark:bg-white dark:text-nokturo-900 text-white font-medium rounded-lg px-5 py-2.5 text-sm hover:bg-nokturo-800 dark:hover:bg-nokturo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('auth.changingPassword')}
                </>
              ) : (
                t('settings.security.changePassword')
              )}
            </button>
          </form>
        </div>
      </div>
    </PageShell>
  );
}
