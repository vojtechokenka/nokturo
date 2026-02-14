// ──────────────────────────────────────────────
// RBAC – Role-Based Access Control for Nokturo
// ──────────────────────────────────────────────

export type Role = 'founder' | 'engineer' | 'viewer' | 'client';

export interface Permission {
  read: boolean;
  write: boolean;
  comment: boolean;
  delete: boolean;
}

export type Module =
  | 'brand.strategy'
  | 'brand.identity'
  | 'prototyping.moodboard'
  | 'prototyping.ideas'
  | 'production.materials'
  | 'production.components'
  | 'production.labels'
  | 'production.products'
  | 'production.sampling'
  | 'business.costing'
  | 'business.suppliers'
  | 'business.accounting'
  | 'communication.chat'
  | 'communication.comments';

// Full permission matrix
// Founder = full access
// Engineer = read all; comment on everything; no write/delete
// Viewer = read all except accounting; no comment, no edit
// Client = read + comment on brand strategy, identity, ready for sampling (production.products/sampling)
const permissionMatrix: Record<Role, Record<Module, Permission>> = {
  founder: {
    'brand.strategy':          { read: true, write: true, comment: true, delete: true },
    'brand.identity':          { read: true, write: true, comment: true, delete: true },
    'prototyping.moodboard':   { read: true, write: true, comment: true, delete: true },
    'prototyping.ideas':       { read: true, write: true, comment: true, delete: true },
    'production.materials':    { read: true, write: true, comment: true, delete: true },
    'production.components':   { read: true, write: true, comment: true, delete: true },
    'production.labels':      { read: true, write: true, comment: true, delete: true },
    'production.products':     { read: true, write: true, comment: true, delete: true },
    'production.sampling':     { read: true, write: true, comment: true, delete: true },
    'business.costing':       { read: true, write: true, comment: true, delete: true },
    'business.suppliers':      { read: true, write: true, comment: true, delete: true },
    'business.accounting':     { read: true, write: true, comment: true, delete: true },
    'communication.chat':     { read: true, write: true, comment: true, delete: true },
    'communication.comments':  { read: true, write: true, comment: true, delete: true },
  },

  engineer: {
    'brand.strategy':          { read: true,  write: false, comment: true,  delete: false },
    'brand.identity':          { read: true,  write: false, comment: true,  delete: false },
    'prototyping.moodboard':   { read: true,  write: false, comment: true,  delete: false },
    'prototyping.ideas':       { read: true,  write: false, comment: true,  delete: false },
    'production.materials':    { read: true,  write: false, comment: true,  delete: false },
    'production.components':   { read: true,  write: false, comment: true,  delete: false },
    'production.labels':      { read: true,  write: false, comment: true,  delete: false },
    'production.products':     { read: true,  write: false, comment: true,  delete: false },
    'production.sampling':     { read: true,  write: false, comment: true,  delete: false },
    'business.costing':       { read: true,  write: false, comment: true,  delete: false },
    'business.suppliers':      { read: true,  write: false, comment: true,  delete: false },
    'business.accounting':     { read: true,  write: false, comment: true,  delete: false },
    'communication.chat':     { read: true,  write: false, comment: true,  delete: false },
    'communication.comments': { read: true,  write: false, comment: true,  delete: false },
  },

  viewer: {
    'brand.strategy':          { read: true,  write: false, comment: false, delete: false },
    'brand.identity':          { read: true,  write: false, comment: false, delete: false },
    'prototyping.moodboard':   { read: true,  write: false, comment: false, delete: false },
    'prototyping.ideas':       { read: true,  write: false, comment: false, delete: false },
    'production.materials':    { read: true,  write: false, comment: false, delete: false },
    'production.components':   { read: true,  write: false, comment: false, delete: false },
    'production.labels':      { read: true,  write: false, comment: false, delete: false },
    'production.products':     { read: true,  write: false, comment: false, delete: false },
    'production.sampling':     { read: true,  write: false, comment: false, delete: false },
    'business.costing':       { read: true,  write: false, comment: false, delete: false },
    'business.suppliers':      { read: true,  write: false, comment: false, delete: false },
    'business.accounting':     { read: false, write: false, comment: false, delete: false },
    'communication.chat':     { read: true,  write: false, comment: false, delete: false },
    'communication.comments': { read: true,  write: false, comment: false, delete: false },
  },

  client: {
    'brand.strategy':          { read: true,  write: false, comment: true,  delete: false },
    'brand.identity':          { read: true,  write: false, comment: true,  delete: false },
    'prototyping.moodboard':   { read: false, write: false, comment: false, delete: false },
    'prototyping.ideas':       { read: false, write: false, comment: false, delete: false },
    'production.materials':    { read: false, write: false, comment: false, delete: false },
    'production.components':   { read: false, write: false, comment: false, delete: false },
    'production.labels':      { read: false, write: false, comment: false, delete: false },
    'production.products':     { read: true,  write: false, comment: true,  delete: false },
    'production.sampling':     { read: true,  write: false, comment: true,  delete: false },
    'business.costing':       { read: false, write: false, comment: false, delete: false },
    'business.suppliers':      { read: false, write: false, comment: false, delete: false },
    'business.accounting':     { read: false, write: false, comment: false, delete: false },
    'communication.chat':     { read: false, write: false, comment: false, delete: false },
    'communication.comments': { read: false, write: false, comment: false, delete: false },
  },
};

/** Check if a role has a specific permission on a module */
export function hasPermission(role: Role, module: Module, action: keyof Permission): boolean {
  return permissionMatrix[role]?.[module]?.[action] ?? false;
}

/** Get all permissions for a role on a module */
export function getPermissions(role: Role, module: Module): Permission {
  return permissionMatrix[role]?.[module] ?? { read: false, write: false, comment: false, delete: false };
}

/** Get all accessible modules for a role (at least read) */
export function getAccessibleModules(role: Role): Module[] {
  const modules = Object.keys(permissionMatrix[role]) as Module[];
  return modules.filter((m) => permissionMatrix[role][m].read);
}

/** Check if a role can access a navigation section */
export function canAccessSection(role: Role, section: string): boolean {
  const sectionModules = Object.keys(permissionMatrix[role]).filter((m) =>
    m.startsWith(section + '.')
  ) as Module[];
  return sectionModules.some((m) => permissionMatrix[role][m].read);
}

/** Check if a role can access a specific module (for per-item nav filtering) */
export function canAccessModule(role: Role, module: Module): boolean {
  return hasPermission(role, module, 'read');
}

/** Only founder can delete anything. Used to hide/disable delete buttons. */
export function canDeleteAnything(role: Role): boolean {
  return role === 'founder';
}
