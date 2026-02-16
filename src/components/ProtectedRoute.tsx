import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { canAccessRoute } from '../utils/permissions';
import type { Role } from '../lib/rbac';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Override: only allow these roles (ignores ROUTE_PERMISSIONS) */
  allowedRoles?: Role[];
}

/**
 * Wraps a route element to enforce role-based access control.
 *
 * Usage:
 *   <Route path="/settings/users" element={
 *     <ProtectedRoute>
 *       <UsersPage />
 *     </ProtectedRoute>
 *   } />
 *
 * Or with explicit roles:
 *   <ProtectedRoute allowedRoles={['founder', 'engineer']}>
 *     <SomePage />
 *   </ProtectedRoute>
 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const location = useLocation();

  if (isLoading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check explicit allowedRoles override or route-based permissions
  const hasAccess = allowedRoles
    ? allowedRoles.includes(user.role)
    : canAccessRoute(location.pathname, user.role);

  if (!hasAccess) {
    // Redirect to a safe default page instead of showing an error
    return <Navigate to="/brand/strategy" replace />;
  }

  return <>{children}</>;
}
