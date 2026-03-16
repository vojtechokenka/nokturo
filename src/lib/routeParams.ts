/**
 * Normalizes React Router params which can be string | string[] (e.g. from dynamic segments).
 */
export function singleParam(p: string | string[] | undefined): string {
  if (p == null) return '';
  return Array.isArray(p) ? (p[0] ?? '') : p;
}
