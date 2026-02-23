import { useState, useEffect, useRef } from 'react';
import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { NotificationCenter } from '../components/NotificationCenter';
import { DefaultAvatar } from '../components/DefaultAvatar';
import { useAuthStore, getCachedAvatarUrl } from '../stores/authStore';
import { useSidebarStore } from '../stores/sidebarStore';
import { supabase } from '../lib/supabase';
import { Loader2, Menu, ClipboardList, Settings, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function ProfileDropdown() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    if (import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true') {
      useAuthStore.getState().logout();
    } else {
      await supabase.auth.signOut();
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative shrink-0 w-8 h-8 rounded-full overflow-hidden bg-nokturo-300 dark:bg-nokturo-600 flex items-center justify-center hover:ring-2 hover:ring-nokturo-400 dark:hover:ring-nokturo-500 transition-all focus:outline-none"
      >
        {(user?.avatarUrl || (user?.id && getCachedAvatarUrl(user.id))) ? (
          <img src={user?.avatarUrl || (user?.id ? getCachedAvatarUrl(user.id) : '')} alt="" className="w-full h-full object-cover" />
        ) : (
          <DefaultAvatar size={32} />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-nokturo-800 rounded-xl shadow-xl z-20 overflow-hidden border border-nokturo-200 dark:border-nokturo-700">
            {/* User info */}
            <div className="px-4 py-3 border-b border-nokturo-200/60 dark:border-nokturo-700/60">
              <div className="text-sm font-medium text-nokturo-900 dark:text-nokturo-100 truncate">
                {user?.firstName || user?.name}
              </div>
              <div className="text-xs text-nokturo-600 dark:text-nokturo-400 truncate">
                {user?.role && t(`roles.${user.role}`)}
              </div>
            </div>

            {/* Menu items */}
            <div className="py-1">
              <button
                onClick={() => { setOpen(false); navigate('/tasks'); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-700/50 transition-colors"
              >
                <ClipboardList className="w-4 h-4 text-nokturo-500 dark:text-nokturo-400" />
                {t('tasks.myTasks')}
              </button>
              <button
                onClick={() => { setOpen(false); navigate('/settings/account'); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-700/50 transition-colors"
              >
                <Settings className="w-4 h-4 text-nokturo-500 dark:text-nokturo-400" />
                {t('common.settings')}
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-700/50 transition-colors"
              >
                <LogOut className="w-4 h-4 text-nokturo-500 dark:text-nokturo-400" />
                {t('common.logout')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function AppLayout() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const mobileOpen = useSidebarStore((s) => s.mobileOpen);
  const toggleSidebar = useSidebarStore((s) => s.toggle);
  const closeSidebar = useSidebarStore((s) => s.close);

  if (isLoading) {
    return (
      <div className="flex h-screen bg-nokturo-50 dark:bg-nokturo-900 items-center justify-center">
        <Loader2 className="w-8 h-8 text-nokturo-500 dark:text-nokturo-400 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen bg-nokturo-50 dark:bg-nokturo-900 text-nokturo-900 dark:text-nokturo-100">
      {/* Desktop sidebar */}
      <div className="hidden md:flex shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 animate-sidebar-overlay"
            onClick={closeSidebar}
          />
          <div className="relative z-10 h-full w-60 animate-sidebar-in">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <div className="flex items-center h-14 px-4 border-b border-nokturo-200 dark:border-nokturo-700 bg-nokturo-100 dark:bg-nokturo-800 md:hidden shrink-0">
          <button
            type="button"
            onClick={toggleSidebar}
            className="p-2 -ml-2 rounded-lg text-nokturo-600 dark:text-nokturo-400 hover:bg-nokturo-200 dark:hover:bg-nokturo-700 transition-colors"
            aria-label="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <svg className="h-[28px] w-[28px] ml-3" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="4" fill="black"/>
            <path d="M21.9925 9.57141C21.9925 12.8413 19.3136 15.4966 16.0034 15.5057C14.3506 15.5057 12.8517 14.839 11.7659 13.7664C10.6801 12.6939 10.0075 11.2109 10.0075 9.57141C10.0075 11.2109 9.33257 12.8163 8.24677 14.0159C7.16098 15.2131 5.65968 16 4 16C7.31707 16 10.0075 19.1496 10.0075 22.4286C10.0075 19.1564 12.6864 16.5034 15.9966 16.4943C17.6494 16.4943 19.1484 17.161 20.2341 18.2313C21.3199 19.3038 21.9925 20.7868 21.9925 22.4286C21.9925 20.7868 22.6651 19.1837 23.7509 17.9841C24.839 16.7868 26.3403 16 28 16C24.6806 16 21.9925 12.8481 21.9925 9.57141Z" fill="white"/>
          </svg>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-nokturo-50 dark:bg-nokturo-900">
          {/* Sticky top bar */}
          <div className="sticky top-0 z-30 bg-nokturo-200 dark:bg-nokturo-700">
            <div className="flex items-center gap-2 px-4 sm:px-6 h-[52px]">
              <div className="flex-1" />
              <NotificationCenter />
              <ProfileDropdown />
            </div>
          </div>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
