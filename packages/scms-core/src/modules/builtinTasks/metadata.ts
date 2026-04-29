import { scopes } from '../../scopes.js';
import { BUILTIN_TASK_IDS } from './ids.js';

/**
 * Server-safe list of built-in dashboard tasks (id + optional scopes).
 * Keep in sync with task definitions in `registry.tsx`.
 */
export const BUILTIN_TASK_META: ReadonlyArray<{ id: string; scopes?: string[] }> = [
  { id: BUILTIN_TASK_IDS.automatedChecks },
];

function taskVisibleForScopes(taskScopes: string[] | undefined, userScopes: string[]): boolean {
  if (userScopes.includes(scopes.system.admin)) return true;
  if (taskScopes && taskScopes.length > 0) {
    if (userScopes.length === 0) return false;
    return taskScopes.every((s) => userScopes.includes(s));
  }
  return true;
}

/**
 * Returns built-in task ids listed in config, in list order, scoped to the user.
 * Unknown ids are skipped.
 */
export function getAllowedBuiltinTaskIds(
  builtinsConfig: string[] | undefined,
  userScopes: string[],
): string[] {
  const metaById = new Map(BUILTIN_TASK_META.map((m) => [m.id, m]));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of builtinsConfig ?? []) {
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    const meta = metaById.get(id);
    if (!meta) continue;
    if (!taskVisibleForScopes(meta.scopes, userScopes)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
