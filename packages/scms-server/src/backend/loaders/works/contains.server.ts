import { DEFAULT_WORK_CONTENTS, WorkContents } from '@curvenote/scms-core';

/** Undefined → fallback; explicit [] stays []. */
export function resolveVersionContains(
  requested: string[] | undefined,
  fallback: string[] = DEFAULT_WORK_CONTENTS,
): string[] {
  if (requested === undefined) return [...fallback];
  return Array.from(new Set(requested));
}

/**
 * UI-driven draft upload / create-new-version: do not inherit prior version labels
 * (especially `myst`). New drafts start as files-only; converter merges `myst` later.
 * CLI register/push use {@link resolveVersionContains} / explicit `['myst']` instead.
 */
export function draftUploadVersionContains(): string[] {
  return [WorkContents.FILES];
}

export function mergeWorkContains(
  existing: string[] | undefined | null,
  incoming: string[],
): string[] {
  return Array.from(new Set([...(existing ?? []), ...incoming]));
}
