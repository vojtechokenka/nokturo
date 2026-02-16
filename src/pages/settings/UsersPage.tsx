import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { PageShell } from '../../components/PageShell';
import { SelectField } from '../../components/SelectField';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { UserPlus, Loader2, Copy, Check, ArrowLeft } from 'lucide-react';
import type { Role } from '../../lib/rbac';
import { INPUT_CLASS } from '../../lib/inputStyles';

const ROLES: Role[] = ['founder', 'engineer', 'viewer', 'client', 'host'];

function isSessionExpiredError(msg: string | undefined): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return lower.includes('session expired') || lower.includes('relace vypršela');
}

export default function UsersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canCreate = user?.role === 'founder';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('client');
  const [customPassword, setCustomPassword] = useState('');
  const [useCustomPassword, setUseCustomPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAuthError(false);
    setResult(null);

    if (user?.id === 'dev-user') {
      setError(t('settings.users.errorDevBypass'));
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError(t('settings.users.emailRequired'));
      return;
    }

    if (useCustomPassword && customPassword.length < 8) {
      setError(t('settings.users.passwordMinLength'));
      return;
    }

    setSubmitting(true);
    try {
      // Refresh session to avoid expired token, then pass it explicitly (avoids 401)
      const { data: refreshData } = await supabase.auth.refreshSession();
      const session = refreshData?.session ?? (await supabase.auth.getSession()).data?.session;
      const token = session?.access_token;
      if (!token) {
        setError(t('settings.users.error401'));
        setAuthError(true);
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke('create-user', {
        body: {
          email: trimmedEmail,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim() || null,
          role,
          ...(useCustomPassword && customPassword ? { password: customPassword } : {}),
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (fnError) {
        const isEdgeFunctionUnreachable =
          fnError.message?.includes('Failed to send a request to the Edge Function') ||
          (fnError as { name?: string }).name === 'FunctionsFetchError';
        if (isEdgeFunctionUnreachable) {
          setError(t('settings.users.errorEdgeFunction'));
          return;
        }
        // For non-2xx responses (FunctionsHttpError), extract the actual error from the response body
        const isNon2xx =
          fnError instanceof FunctionsHttpError || (fnError as { name?: string }).name === 'FunctionsHttpError';
        if (isNon2xx && fnError.context) {
          try {
            const res = fnError.context as Response;
            const text = await res.text();
            let msg: string | undefined;
            try {
              const body = text ? JSON.parse(text) : null;
              msg = typeof body?.error === 'string' ? body.error : body?.error?.message;
            } catch {
              if (text) msg = text;
            }
            if (msg) {
              if (res.status === 401 || isSessionExpiredError(msg)) {
                setError(t('settings.users.error401'));
                setAuthError(true);
                return;
              }
              setError(msg);
              return;
            }
            // Fallback: show status-based hint
            if (res.status === 401) {
              setError(t('settings.users.error401'));
              setAuthError(true);
              return;
            }
            if (res.status === 403) {
              setError(t('settings.users.error403'));
              return;
            }
            if (res.status === 400) {
              setError(t('settings.users.error400'));
              return;
            }
          } catch {
            /* ignore */
          }
        }
        setError(fnError.message || t('settings.users.error'));
        return;
      }

      const err = data?.error;
      if (err) {
        const errMsg = typeof err === 'string' ? err : err.message || t('settings.users.error');
        if (isSessionExpiredError(errMsg)) {
          setError(t('settings.users.error401'));
          setAuthError(true);
          return;
        }
        setError(errMsg);
        return;
      }

      if (data?.password) {
        setResult({ email: data.email || trimmedEmail, password: data.password });
      }
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setRole('client');
      setCustomPassword('');
    } catch {
      setError(t('settings.users.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const copyPassword = () => {
    if (!result) return;
    const text = `${t('settings.users.loginCredentials')}\n\n${t('auth.email')}: ${result.email}\n${t('auth.password')}: ${result.password}\n\n${t('settings.users.passwordHint')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!canCreate) {
    return (
      <PageShell>
        <div className="max-w-2xl">
          <Link
            to="/settings/account"
            className="inline-flex items-center gap-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('settings.users.backToSettings')}
          </Link>
          <h1 className="text-heading-2 font-extralight text-nokturo-900 dark:text-nokturo-100 mb-2">
            {t('settings.users.title')}
          </h1>
          <p className="text-nokturo-600 dark:text-nokturo-400">
            {t('settings.users.forbidden')}
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="max-w-lg">
        <Link
          to="/settings/account"
          className="inline-flex items-center gap-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('settings.users.backToSettings')}
        </Link>
        <h1 className="text-heading-2 font-extralight text-nokturo-900 dark:text-nokturo-100 mb-1">
          {t('settings.users.title')}
        </h1>
        <p className="text-nokturo-600 dark:text-nokturo-400 text-sm mb-6">
          {t('settings.users.description')}
        </p>

        {user?.id === 'dev-user' && (
          <div className="mb-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-300/30 text-amber-800 dark:text-amber-300 text-sm">
            {t('settings.users.errorDevBypass')}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-nokturo-700 dark:text-nokturo-400 mb-1">
                {t('settings.account.firstName')} *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={INPUT_CLASS}
                placeholder={t('settings.users.firstNamePlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-nokturo-700 dark:text-nokturo-400 mb-1">
                {t('settings.account.lastName')} *
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={INPUT_CLASS}
                placeholder={t('settings.users.lastNamePlaceholder')}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-nokturo-700 dark:text-nokturo-400 mb-1">
              {t('auth.email')} *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={INPUT_CLASS}
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-nokturo-700 dark:text-nokturo-400 mb-1">
              {t('settings.account.phone')} {t('settings.account.phoneOptional')}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={INPUT_CLASS}
              placeholder="+420 ..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-nokturo-700 dark:text-nokturo-400 mb-1">
              {t('settings.users.role')} *
            </label>
            <SelectField
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`roles.${r}`)}
                </option>
              ))}
            </SelectField>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useCustomPassword}
                onChange={(e) => setUseCustomPassword(e.target.checked)}
              />
              <span className="text-sm text-nokturo-700 dark:text-nokturo-400">
                {t('settings.users.customPassword')}
              </span>
            </label>
            {useCustomPassword && (
              <input
                type="password"
                value={customPassword}
                onChange={(e) => setCustomPassword(e.target.value)}
                className="mt-2 w-full px-3 py-2 rounded-lg bg-nokturo-200/60 dark:bg-nokturo-700/60 text-nokturo-900 dark:text-nokturo-100 placeholder-nokturo-500 dark:placeholder-nokturo-400 border border-nokturo-300 dark:border-nokturo-600 focus:outline-none focus:ring-2 focus:ring-nokturo-500 transition-colors"
                placeholder={t('settings.users.customPasswordPlaceholder')}
                minLength={8}
              />
            )}
            {!useCustomPassword && (
              <p className="text-xs text-nokturo-500 dark:text-nokturo-400 mt-1">
                {t('settings.users.autoGenerateHint')}
              </p>
            )}
            <p className="text-xs text-nokturo-500 dark:text-nokturo-400 mt-1">
              {t('settings.users.passwordNotSent')}
            </p>
          </div>

          {error && (
            <div className="text-red-700 dark:text-red-300 text-sm bg-red-50 dark:bg-red-900/30 rounded-lg px-4 py-2 space-y-2">
              <p>{error}</p>
              {authError && (
                <button
                  type="button"
                  onClick={() => {
                    useAuthStore.getState().logout();
                    navigate('/login', { replace: true });
                  }}
                  className="underline hover:no-underline font-medium"
                >
                  {t('settings.users.signInAgain')}
                </button>
              )}
            </div>
          )}

          {result && (
            <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                {t('settings.users.createdSuccess')}
              </p>
              <div className="bg-white dark:bg-nokturo-800 rounded-lg p-3 font-mono text-sm space-y-1">
                <p><span className="text-nokturo-500 dark:text-nokturo-400">{t('auth.email')}:</span> <span className="text-nokturo-900 dark:text-nokturo-100">{result.email}</span></p>
                <p><span className="text-nokturo-500 dark:text-nokturo-400">{t('auth.password')}:</span> <span className="text-nokturo-900 dark:text-nokturo-100">{result.password}</span></p>
              </div>
              <p className="text-xs text-nokturo-600 dark:text-nokturo-400">
                {t('settings.users.passwordHint')}
              </p>
              <button
                type="button"
                onClick={copyPassword}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-nokturo-900 dark:bg-white dark:text-nokturo-900 text-white rounded-lg hover:bg-nokturo-800 dark:hover:bg-nokturo-100 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    {t('settings.users.copied')}
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    {t('settings.users.copyCredentials')}
                  </>
                )}
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 w-full py-3 bg-nokturo-900 dark:bg-white dark:text-nokturo-900 text-white font-medium rounded-lg hover:bg-nokturo-800 dark:hover:bg-nokturo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('settings.users.creating')}
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                {t('settings.users.createUser')}
              </>
            )}
          </button>
        </form>
      </div>
    </PageShell>
  );
}
