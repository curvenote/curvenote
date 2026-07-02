import { DEFAULT_WORK_CONTENTS, WorkContents } from '@curvenote/scms-core';

/** Undefined → fallback; explicit [] stays []. */
export function resolveVersionContains(
  requested: string[] | undefined,
  fallback: string[] = DEFAULT_WORK_CONTENTS,
): string[] {
  if (requested === undefined) return [...fallback];
  return Array.from(new Set(requested));
}

/** Upload-new-version draft: carry forward the prior version labels and mark FILES. */
export function draftUploadVersionContains(previousVersionContains: string[]): string[] {
  const labels = [...previousVersionContains];
  if (!labels.includes(WorkContents.FILES)) {
    labels.push(WorkContents.FILES);
  }
  return Array.from(new Set(labels));
}

export function mergeWorkContains(
  existing: string[] | undefined | null,
  incoming: string[],
): string[] {
  return Array.from(new Set([...(existing ?? []), ...incoming]));
}
