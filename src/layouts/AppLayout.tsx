import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useAuthStore } from '../stores/authStore';
import { useSidebarStore } from '../stores/sidebarStore';
import { Loader2, Menu } from 'lucide-react';

export function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const mobileOpen = useSidebarStore((s) => s.mobileOpen);
  const toggleSidebar = useSidebarStore((s) => s.toggle);
  const closeSidebar = useSidebarStore((s) => s.close);

  // Show spinner while Supabase restores the session
  if (isLoading) {
    return (
      <div className="flex h-screen bg-nokturo-50 dark:bg-nokturo-900 items-center justify-center">
        <Loader2 className="w-8 h-8 text-nokturo-500 dark:text-nokturo-400 animate-spin" />
      </div>
    );
  }

  // Not signed in → send to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen bg-nokturo-50 dark:bg-nokturo-900 text-nokturo-900 dark:text-nokturo-100">
      {/* Desktop sidebar – always visible at md+ */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay – only below md */}
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
      <div className="flex-1 flex flex-col overflow-hidden">
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
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
