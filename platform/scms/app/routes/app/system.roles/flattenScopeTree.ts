import { scopes } from '@curvenote/scms-core';

/**
 * Collects every string leaf from a nested object tree (e.g. scope definitions keyed by area).
 */
export function flattenScopeTree(tree: unknown): string[] {
  const values: string[] = [];
  const visit = (node: unknown) => {
    if (typeof node === 'string') {
      values.push(node);
      return;
    }
    if (node && typeof node === 'object') {
      for (const value of Object.values(node as Record<string, unknown>)) {
        visit(value);
      }
    }
  };
  visit(tree);
  return Array.from(new Set(values)).sort();
}

/**
 * `work:*` scopes eligible for System Roles "Known scopes" chips: only top-level
 * string fields on `scopes.work`, excluding the nested `id` subtree (do not flatten it).
 */
export function flattenWorkRootScopesForSystemRoles(): string[] {
  const tree = scopes.work as Record<string, unknown>;
  const out: string[] = [];
  for (const [key, value] of Object.entries(tree)) {
    if (key === 'id') continue;
    if (typeof value === 'string') {
      out.push(value);
    }
  }
  return Array.from(new Set(out)).sort();
}
