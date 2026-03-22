import { Outlet, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ToastContainer } from '../components/Toast';
import { ProfileDropdown } from '../components/ProfileDropdown';
import { useAuthStore } from '../stores/authStore';
import { useSidebarStore } from '../stores/sidebarStore';
import { useToastStore } from '../stores/toastStore';
import { MaterialIcon } from '../components/icons/MaterialIcon';
import { MyTasksIcon } from '../components/icons/MyTasksIcon';
import { SettingsIcon } from '../components/icons/SettingsIcon';
import { useTranslation } from 'react-i18next';

export function AppLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const isBareLayout = location.pathname.includes('moodboard') || location.pathname.includes('ideas');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const mobileOpen = useSidebarStore((s) => s.mobileOpen);
  const toggleSidebar = useSidebarStore((s) => s.toggle);
  const navigate = useNavigate();
  const globalToasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (isLoading) {
    return (
      <div className="flex h-screen bg-page items-center justify-center">
        <MaterialIcon name="progress_activity" size={32} className="text-nokturo-500 dark:text-nokturo-400 animate-spin shrink-0" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-page text-nokturo-900 dark:text-nokturo-100">
      {/* Sidebar (desktop static, mobile push) */}
      <div
        className={`shrink-0 transition-[margin] duration-300 ease-in-out ${
          mobileOpen ? 'ml-0' : '-ml-60'
        } md:ml-0`}
      >
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="shrink-0 w-full md:shrink md:w-auto flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Page content */}
        <main className="flex-1 flex flex-col overflow-hidden bg-page">
          {/* Sticky top bar */}
          <div className="shrink-0 z-30 bg-header">
            <div className="flex items-center gap-4 px-4 sm:px-6 h-[60px]">
              <button
                type="button"
                onClick={toggleSidebar}
                className="md:hidden p-2 -ml-2 text-nokturo-600 dark:text-nokturo-400 hover:bg-nokturo-200 dark:hover:bg-nokturo-700 transition-colors"
                aria-label="Menu"
              >
                <MaterialIcon name="menu" size={20} className="shrink-0" />
              </button>
              <Link
                to="/tasks"
                className="hidden sm:flex items-center gap-2 text-sm text-nokturo-700 dark:text-nokturo-200 hover:text-nokturo-900 dark:hover:text-nokturo-100 transition-colors"
              >
                <MyTasksIcon size={16} className="shrink-0 text-nokturo-500 dark:text-nokturo-400" />
                {t('tasks.myTasks')}
              </Link>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => navigate('/settings/account')}
                className="flex items-center gap-2 px-3 py-2 text-sm text-nokturo-700 dark:text-nokturo-200 hover:text-nokturo-900 dark:hover:text-nokturo-100 transition-colors"
              >
                <SettingsIcon size={16} className="text-nokturo-500 dark:text-nokturo-400 shrink-0" />
                <span className="hidden sm:inline">{t('common.settings')}</span>
              </button>
              <ProfileDropdown />
            </div>
          </div>
          {/* Frame – padding + window stay fixed, content scrolls inside window (no padding for Moodboard) */}
          <div translate="no" className={`flex-1 min-h-0 overflow-hidden flex flex-col ${isBareLayout ? '' : 'pt-0 px-0 pb-0 sm:pt-6 sm:px-6 sm:pb-6'}`}>
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Global toasts (bottom-right) */}
      <ToastContainer
        toasts={globalToasts}
        onClose={removeToast}
        position="right"
      />
    </div>
  );
}
