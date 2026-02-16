// ──────────────────────────────────────────────
// Centralized Permissions – Route & Feature level
// ──────────────────────────────────────────────

import type { Role } from '../lib/rbac';

// Route permissions – which roles can access which pages
export const ROUTE_PERMISSIONS: Record<string, Role[]> = {
  '/settings/users': ['founder'],
  '/brand/strategy': ['founder', 'engineer', 'viewer', 'client', 'host'],
  '/brand/identity': ['founder', 'engineer', 'viewer', 'client', 'host'],
  '/prototyping/moodboard': ['founder', 'engineer', 'viewer', 'host'],
  '/prototyping/ideas': ['founder', 'engineer', 'viewer'],
  '/production/materials': ['founder', 'engineer', 'viewer'],
  '/production/components': ['founder', 'engineer', 'viewer'],
  '/production/labels': ['founder', 'engineer', 'viewer'],
  '/production/products': ['founder', 'engineer', 'viewer', 'client'],
  '/production/products/:id': ['founder', 'engineer', 'viewer', 'client'],
  '/production/sampling': ['founder', 'engineer', 'viewer', 'client'],
  '/production/sampling/:productId': ['founder', 'engineer', 'viewer', 'client'],
  '/business/costing': ['founder', 'engineer', 'viewer'],
  '/business/suppliers': ['founder', 'engineer', 'viewer'],
  '/business/accounting': ['founder', 'engineer'],
  '/communication/chat': ['founder', 'engineer', 'viewer'],
  '/communication/comments': ['founder', 'engineer', 'viewer'],
  '/settings/account': ['founder', 'engineer', 'viewer', 'client', 'host'],
  '/settings/security': ['founder', 'engineer', 'viewer', 'client', 'host'],
};

// Feature permissions – which roles can use which features
export const FEATURE_PERMISSIONS = {
  canCreateUser: ['founder'] as Role[],
  canDeleteUser: ['founder'] as Role[],
  canEditUser: ['founder'] as Role[],

  canCreateProject: ['founder', 'engineer'] as Role[],
  canEditProject: ['founder', 'engineer'] as Role[],
  canDeleteProject: ['founder'] as Role[],
  canViewProjects: ['founder', 'engineer', 'client'] as Role[],

  canCreateTask: ['founder', 'engineer'] as Role[],
  canEditTask: ['founder', 'engineer'] as Role[],
  canDeleteTask: ['founder', 'engineer'] as Role[],
  canViewTasks: ['founder', 'engineer', 'client'] as Role[],

  canComment: ['founder', 'engineer', 'client'] as Role[],
  canDeleteComment: ['founder'] as Role[],

  canUploadFiles: ['founder', 'engineer'] as Role[],
  canDeleteFiles: ['founder', 'engineer'] as Role[],

  canExportData: ['founder', 'engineer'] as Role[],
  canViewAnalytics: ['founder', 'engineer'] as Role[],
} as const;

export type FeatureAction = keyof typeof FEATURE_PERMISSIONS;

/** Check if a role can access a specific route */
export function canAccessRoute(path: string, userRole: Role): boolean {
  // Try exact match first
  if (ROUTE_PERMISSIONS[path]) {
    return ROUTE_PERMISSIONS[path].includes(userRole);
  }

  // Try pattern match (for dynamic segments like :id)
  const routeKey = Object.keys(ROUTE_PERMISSIONS).find((route) => {
    const pattern = route.replace(/:\w+/g, '[^/]+');
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(path);
  });

  if (!routeKey) return true; // Unprotected route – allow
  return ROUTE_PERMISSIONS[routeKey].includes(userRole);
}

/** Check if a role has a specific feature permission */
export function hasFeaturePermission(action: FeatureAction, userRole: Role): boolean {
  const allowedRoles = FEATURE_PERMISSIONS[action];
  return allowedRoles?.includes(userRole) ?? false;
}

/** Get all routes accessible by a role */
export function getAccessibleRoutes(userRole: Role): string[] {
  return Object.entries(ROUTE_PERMISSIONS)
    .filter(([, roles]) => roles.includes(userRole))
    .map(([route]) => route);
}

/** Get all features available to a role */
export function getAvailableFeatures(userRole: Role): FeatureAction[] {
  return (Object.entries(FEATURE_PERMISSIONS) as [FeatureAction, Role[]][])
    .filter(([, roles]) => roles.includes(userRole))
    .map(([feature]) => feature);
}
