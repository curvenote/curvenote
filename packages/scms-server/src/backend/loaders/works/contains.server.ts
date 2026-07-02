import { DEFAULT_WORK_CONTENTS } from '@curvenote/scms-core';

/** Undefined → fallback; explicit [] stays []. */
export function resolveVersionContains(
  requested: string[] | undefined,
  fallback: string[] = DEFAULT_WORK_CONTENTS,
): string[] {
  if (requested === undefined) return [...fallback];
  return Array.from(new Set(requested));
}

export function mergeWorkContains(
  existing: string[] | undefined | null,
  incoming: string[],
): string[] {
  return Array.from(new Set([...(existing ?? []), ...incoming]));
}
