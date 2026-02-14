import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/auth/callback'];

/**
 * Emergency redirect: when app is in inconsistent state (no user, not loading)
 * and we're not on a public route, redirect to login.
 * Zákaz redirectu: dokud není isInitialized, nesmíme přesměrovat na /login.
 */
export function AppGuard() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  const pathname = location?.pathname ?? '';
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (!isInitialized) {
    return <Outlet />;
  }
  if (!user && !isLoading && !isPublic) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
