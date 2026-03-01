import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore, getCachedAvatarUrl } from '../stores/authStore';
import { DefaultAvatar } from './DefaultAvatar';
import { useNotifications, NotificationPanel } from './NotificationCenter';
import { Loader2 } from 'lucide-react';
import { LogOutIcon } from './icons/LogOutIcon';
import { SettingsIcon } from './icons/SettingsIcon';

export function ProfileDropdown() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownWidth, setDropdownWidth] = useState<number | null>(null);

  const {
    notifications,
    unreadCount,
    fetchNotifications,
    markAllRead,
    clearAll,
    handleNotificationClick,
    formatTime,
  } = useNotifications();

  const longestTitle = notifications.length
    ? notifications.reduce((a, b) => (a.title?.length ?? 0) >= (b.title?.length ?? 0) ? a : b).title ?? ''
    : '';

  useLayoutEffect(() => {
    if (!open || !measureRef.current) return;
    const w = measureRef.current.getBoundingClientRect().width;
    // title + dot(8) + gap(12) + button px(32) + list p(24) = w + 76
    const total = Math.min(window.innerWidth - 32, Math.max(320, Math.ceil(w) + 76));
    setDropdownWidth(total);
  }, [open, longestTitle]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  const handleLogout = async () => {
    setOpen(false);
    setIsLoggingOut(true);
    try {
      if (import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true') {
        useAuthStore.getState().logout();
      } else {
        await supabase.auth.signOut();
      }
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      {isLoggingOut && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-xl bg-white dark:bg-nokturo-800 px-6 py-5 shadow-xl">
            <Loader2 className="w-8 h-8 text-nokturo-500 dark:text-nokturo-400 animate-spin" />
            <span className="text-sm text-nokturo-700 dark:text-nokturo-300">{t('common.loggingOut')}</span>
          </div>
        </div>
      )}
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`avatar-round relative shrink-0 w-8 h-8 bg-nokturo-300 dark:bg-nokturo-600 flex items-center justify-center transition-all focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 active:outline-none active:ring-0 active:ring-offset-0 active:shadow-none overflow-visible ${open ? 'z-[30]' : ''}`}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <span className="avatar-round absolute inset-0 overflow-hidden flex items-center justify-center">
            {(user?.avatarUrl || (user?.id && getCachedAvatarUrl(user.id))) ? (
              <img src={user?.avatarUrl || (user?.id ? getCachedAvatarUrl(user.id) : '')} alt="" className="w-full h-full object-cover" />
            ) : (
              <DefaultAvatar size={32} />
            )}
          </span>
          {unreadCount > 0 && (
            <span
              className="avatar-round absolute left-auto -top-0.5 -right-0.5 w-3 h-3 bg-[#FF1A1A] border-2 border-white dark:border-black"
              aria-hidden
            />
          )}
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10 bg-black/80 pointer-events-none" aria-hidden />
            <div
              ref={dropdownRef}
              className="profile-dropdown absolute right-0 bg-white dark:bg-black shadow-xl z-20"
              style={{
                top: 'calc(100% + 8px)',
                width: dropdownWidth ? `${dropdownWidth}px` : 320,
              }}
            >
              <span
                ref={measureRef}
                className="absolute opacity-0 pointer-events-none text-sm leading-snug font-medium whitespace-nowrap"
                aria-hidden
              >
                {longestTitle || ' '}
              </span>
              <div className="flex flex-col w-full">
              {/* User info + menu buttons row */}
              <div className="flex items-center justify-between gap-4 px-4 py-3 dark:bg-white/10">
                <button
                  onClick={() => { setOpen(false); navigate('/settings/account'); }}
                  className="flex flex-col items-start text-left hover:opacity-80 transition-opacity"
                >
                  <span className="text-sm font-medium text-nokturo-900 dark:text-nokturo-100 truncate">
                    {user?.firstName || user?.name}
                  </span>
                  <span className="text-xs text-nokturo-600 dark:text-nokturo-400 truncate">
                    {user?.role && t(`roles.${user.role}`)}
                  </span>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => { setOpen(false); navigate('/settings/account'); }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-nokturo-700 dark:text-nokturo-200 bg-white/10 rounded-[6px] hover:bg-nokturo-50 dark:hover:bg-white/20 transition-colors"
                  >
                    <SettingsIcon size={16} className="text-nokturo-500 dark:text-nokturo-400 shrink-0" />
                    {t('common.settings')}
                  </button>
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-nokturo-700 dark:text-nokturo-200 bg-white/10 rounded-[6px] hover:bg-nokturo-50 dark:hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoggingOut ? (
                      <Loader2 className="w-4 h-4 text-nokturo-500 dark:text-nokturo-400 animate-spin" />
                    ) : (
                      <LogOutIcon size={16} className="text-nokturo-500 dark:text-nokturo-400 shrink-0" />
                    )}
                    {isLoggingOut ? t('common.loggingOut') : t('common.logout')}
                  </button>
                </div>
              </div>

              {/* Notifications */}
              <NotificationPanel
                notifications={notifications}
                unreadCount={unreadCount}
                markAllRead={markAllRead}
                clearAll={clearAll}
                handleNotificationClick={handleNotificationClick}
                formatTime={formatTime}
                onClose={() => setOpen(false)}
              />

              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
