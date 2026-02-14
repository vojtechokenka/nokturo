import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useAuthStore } from '../stores/authStore';
import { Loader2 } from 'lucide-react';

export function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

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
      {/* Left sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
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
