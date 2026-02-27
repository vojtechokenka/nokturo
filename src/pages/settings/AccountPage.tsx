import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PageShell } from '../../components/PageShell';
import { LanguageToggle } from '../../components/LanguageToggle';
import { ThemeToggle } from '../../components/ThemeToggle';
import { NavLink } from 'react-router-dom';
import { Globe, Shield, ChevronRight, Loader2, Camera, X, UserPlus, Moon } from 'lucide-react';
import { useAuthStore, getUserIdForDb } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { supabase } from '../../lib/supabase';
import { DefaultAvatar } from '../../components/DefaultAvatar';
import { resizeAvatarImage } from '../../lib/resizeImage';
import { INPUT_CLASS } from '../../lib/inputStyles';
import { isElectron } from '../../utils/platform';
import { AppUpdateSection } from '../../components/AppUpdateSection';

export default function AccountPage() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userId = getUserIdForDb();

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (avatarUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(avatarUrl);
      }
    };
  }, [avatarUrl]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, phone, avatar_url, language, theme')
        .eq('id', userId)
        .single();
      if (data) {
        setFirstName(data.first_name ?? '');
        setLastName(data.last_name ?? '');
        setPhone(data.phone ?? '');
        setAvatarUrl(data.avatar_url ?? null);
        // Synchronizovat authStore s profilem z DB – sidebar zobrazí aktuální jméno a avatar
        const u = useAuthStore.getState().user;
        if (u) {
          const fName = (data.first_name as string)?.trim() || undefined;
          const lName = (data.last_name as string)?.trim() || undefined;
          const displayName = [fName, lName].filter(Boolean).join(' ') || u.name || u.email || '';
          setUser({
            ...u,
            firstName: fName,
            lastName: lName,
            name: displayName,
            avatarUrl: (data.avatar_url as string) ?? undefined,
          });
        }
      }
      setLoading(false);
    };
    load();
  }, [userId]);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    if (!userId) {
      showToast('error', t('settings.account.signInRequired'));
      return;
    }
    setSaving(true);
    try {
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ') || '';
      const currentLang = (i18n.language?.split('-')[0] === 'cs' ? 'cs' : 'en') as 'en' | 'cs';
      const currentTheme = useThemeStore.getState().theme;
      const profileData = {
        email: user?.email ?? '',
        full_name: fullName,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null,
        avatar_url: avatarUrl,
        language: currentLang,
        theme: currentTheme,
      };

      // Try UPDATE first (profile usually exists). If no rows, do INSERT (new user without profile).
      const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('id', userId)
        .select('id')
        .maybeSingle();

      if (updateError) {
        console.error('Profile update error:', updateError);
        throw updateError;
      }

      let newRole: 'founder' | 'client' | undefined;
      if (!updated) {
        // Profile doesn't exist – insert (e.g. user created via Auth UI without trigger)
        // First user in system gets founder role; others get client
        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        const isFirstUser = (count ?? 0) === 0;
        newRole = isFirstUser ? 'founder' : 'client';
        const { error: insertError } = await supabase.from('profiles').insert({
          id: userId,
          ...profileData,
          role: newRole,
        });
        if (insertError) {
          console.error('Profile insert error:', insertError);
          throw insertError;
        }
      }

      const fName = firstName.trim();
      const lName = lastName.trim();
      const displayName =
        [fName, lName].filter(Boolean).join(' ') ||
        user?.email ||
        user?.name;
      setUser({
        ...(user ?? { id: userId, email: '', name: '', role: 'client' as const }),
        name: displayName,
        firstName: fName || undefined,
        lastName: lName || undefined,
        email: user?.email ?? '',
        avatarUrl: avatarUrl ?? undefined,
        language: currentLang,
        theme: currentTheme,
        ...(newRole && { role: newRole }),
      });
      showToast('success', t('settings.account.saved'));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('settings.account.error');
      showToast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (fileOrBlob: File | Blob, ext = 'jpg') => {
    if (!userId) {
      // Dev-user: use blob URL for display (client-side only, no Supabase session)
      const url = URL.createObjectURL(fileOrBlob);
      if (avatarUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(avatarUrl);
      }
      setAvatarUrl(url);
      return;
    }
    setUploadingAvatar(true);
    try {
      const path = `avatars/${userId}/avatar.${ext}`;
      const contentType = fileOrBlob.type || 'image/jpeg';

      const { error } = await supabase.storage
        .from('uploads')
        .upload(path, fileOrBlob, { contentType, cacheControl: '3600', upsert: true });

      if (error) {
        console.error('Avatar upload error:', error);
        throw error;
      }

      const { data } = supabase.storage.from('uploads').getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      // Aktualizovat authStore hned po uploadu, aby sidebar zobrazil profilovku bez čekání na Save
      if (user) {
        setUser({ ...user, avatarUrl: data.publicUrl });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('settings.account.error');
      showToast('error', msg);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = () => {
    if (avatarUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(avatarUrl);
    }
    setAvatarUrl(null);
    if (user) {
      setUser({ ...user, avatarUrl: undefined });
    }
  };

  const MAX_AVATAR_SIZE_KB = 150;
  const MAX_AVATAR_DIMENSION = 256;
  const MAX_INPUT_FILE_MB = 5;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file?.type.startsWith('image/')) return;

    if (file.size > MAX_INPUT_FILE_MB * 1024 * 1024) {
      showToast('error', t('settings.account.fileTooLarge', { max: MAX_INPUT_FILE_MB }));
      return;
    }

    try {
      const blob = await resizeAvatarImage(
        file,
        MAX_AVATAR_DIMENSION,
        MAX_AVATAR_SIZE_KB * 1024
      );
      await handleAvatarUpload(blob, 'jpg');
    } catch {
      showToast('error', t('settings.account.error'));
    }
  };

  if (loading) {
    return (
      <PageShell titleKey="settings.account.title" descriptionKey="settings.account.description">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-nokturo-500 dark:text-nokturo-400 animate-spin" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      titleKey="settings.account.title"
      descriptionKey="settings.account.description"
    >
      <div className="max-w-lg space-y-8">
        {/* Profile section */}
        <section>
          <h3 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100 mb-4">{t('settings.account.profile')}</h3>
          <div className="space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-nokturo-100 dark:bg-nokturo-700 flex items-center justify-center shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <DefaultAvatar size={80} className="rounded-full" />
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="flex flex-col gap-2">
                <p className="text-nokturo-600 dark:text-nokturo-400 text-sm">
                  {t('settings.account.profilePhoto')}
                  <span className="block text-nokturo-500 dark:text-nokturo-500 text-xs mt-0.5">
                    {t('settings.account.profilePhotoHint')}
                  </span>
                </p>
                {user && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-nokturo-700 text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50/70 dark:hover:bg-nokturo-600 transition-colors disabled:opacity-50"
                    >
                      {uploadingAvatar ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Camera className="w-4 h-4" />
                      )}
                      {avatarUrl ? t('settings.account.changePhoto') : t('settings.account.uploadPhoto')}
                    </button>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-nokturo-700 text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50/70 dark:hover:bg-nokturo-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        {t('settings.account.removePhoto')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* First name */}
            <div>
              <label className="block text-sm text-nokturo-600 dark:text-nokturo-400 font-medium mb-1">
                {t('settings.account.firstName')}
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={INPUT_CLASS}
                placeholder={t('settings.account.firstName')}
              />
            </div>

            {/* Last name */}
            <div>
              <label className="block text-sm text-nokturo-600 dark:text-nokturo-400 font-medium mb-1">
                {t('settings.account.lastName')}
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={INPUT_CLASS}
                placeholder={t('settings.account.lastName')}
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="block text-sm text-nokturo-600 dark:text-nokturo-400 font-medium mb-1">
                {t('settings.account.email')} {t('settings.account.emailOptional')}
              </label>
              <input
                type="email"
                value={user?.email ?? ''}
                readOnly
                className="w-full px-3 py-2 rounded-lg bg-nokturo-100 dark:bg-nokturo-800 text-nokturo-500 dark:text-nokturo-400 cursor-not-allowed"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm text-nokturo-600 dark:text-nokturo-400 font-medium mb-1">
                {t('settings.account.phone')} {t('settings.account.phoneOptional')}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={INPUT_CLASS}
                placeholder="+420 …"
              />
            </div>

            {/* Position (read-only info) */}
            <div className="p-4 rounded-lg bg-nokturo-100 dark:bg-nokturo-800 flex items-center justify-between gap-4">
              <p className="text-sm text-nokturo-500 dark:text-nokturo-400">
                {t('settings.account.positionAssigned')}
              </p>
              {user?.role && (
                <span className="text-sm font-medium text-nokturo-700 dark:text-nokturo-300 shrink-0">
                  {t(`roles.${user.role}`)}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Language */}
        <section className="py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-nokturo-200 dark:bg-nokturo-700 flex items-center justify-center">
                <Globe className="w-5 h-5 text-nokturo-600 dark:text-nokturo-300" />
              </div>
              <div>
                <h3 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100">
                  {t('common.language')}
                </h3>
                <p className="text-nokturo-600 dark:text-nokturo-400 text-sm">
                  {t('settings.account.languageDescription')}
                </p>
              </div>
            </div>
            <LanguageToggle />
          </div>
        </section>

        {/* Theme (Dark mode) */}
        <section className="py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-nokturo-200 dark:bg-nokturo-700 flex items-center justify-center">
                <Moon className="w-5 h-5 text-nokturo-600 dark:text-nokturo-300" />
              </div>
              <div>
                <h3 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100">
                  {t('settings.account.theme')}
                </h3>
                <p className="text-nokturo-600 dark:text-nokturo-400 text-sm">
                  {t('settings.account.themeDescription')}
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </section>

        {/* Security shortcut */}
        <NavLink to="/settings/security" className="block py-1">
          <div className="flex items-center gap-3 py-3 -mx-2 px-2 rounded-lg hover:bg-nokturo-50 dark:hover:bg-nokturo-800/50 transition-colors group">
            <div className="w-10 h-10 rounded-lg bg-nokturo-200 dark:bg-nokturo-700 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-nokturo-600 dark:text-nokturo-300" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100">
                {t('settings.security.title')}
              </h3>
              <p className="text-nokturo-600 dark:text-nokturo-400 text-sm">
                {t('settings.security.description')}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-nokturo-400 dark:text-nokturo-500 group-hover:text-nokturo-500 dark:group-hover:text-nokturo-400 shrink-0 transition-colors" />
          </div>
        </NavLink>

        {/* Create user (founder only) */}
        {user?.role === 'founder' && (
          <NavLink to="/settings/users" className="block py-1">
            <div className="flex items-center gap-3 py-3 -mx-2 px-2 rounded-lg hover:bg-nokturo-50 dark:hover:bg-nokturo-800/50 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-nokturo-200 dark:bg-nokturo-700 flex items-center justify-center shrink-0">
                <UserPlus className="w-5 h-5 text-nokturo-600 dark:text-nokturo-300" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100">
                  {t('settings.users.title')}
                </h3>
                <p className="text-nokturo-600 dark:text-nokturo-400 text-sm">
                  {t('settings.users.description')}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-nokturo-400 dark:text-nokturo-500 group-hover:text-nokturo-500 dark:group-hover:text-nokturo-400 shrink-0 transition-colors" />
            </div>
          </NavLink>
        )}

        {/* Save profile button */}
        {user && (
          <div className="pt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-lg bg-nokturo-700 hover:bg-nokturo-600 dark:bg-nokturo-600 dark:hover:bg-nokturo-500 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 className="w-5 h-5 animate-spin" />}
              {t('settings.account.saveProfile')}
            </button>
          </div>
        )}

        {/* App version & update (Electron only) */}
        {isElectron() ? (
          <AppUpdateSection />
        ) : (
          <div className="pt-6 border-t border-nokturo-200 dark:border-nokturo-700">
            <p className="text-sm text-nokturo-500 dark:text-nokturo-400">
              Nokturo <span className="font-medium text-nokturo-700 dark:text-nokturo-300">{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '?'}</span>
              <span className="ml-2 text-nokturo-400 dark:text-nokturo-500">— web</span>
            </p>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg z-50 ${
              toast.type === 'success' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </PageShell>
  );
}

