export enum WorkContents {
  MYST = 'myst',
  FILES = 'files',
  PACKAGE = 'package',
  DATASET = 'dataset',
  // Add other work kinds here as needed
}

export const DEFAULT_WORK_CONTENTS = [WorkContents.MYST];

/**
 * Whether CDN-backed version creation should load Myst article/config from the CDN.
 * - Legacy uploads omit `contains` → treated as Myst (same as DEFAULT_WORK_CONTENTS).
 * - Explicit non-Myst sources (e.g. `contains: ['meca']`) skip Myst CDN parsing.
 * - If `myst` appears in `contains` (alone or with others), use the Myst CDN path.
 */
export function isMystCdnContentSource(contains?: string[] | null): boolean {
  if (contains == null || contains.length === 0) return true;
  return contains.includes(WorkContents.MYST);
}

// export type WorkKind = (typeof WorkContents)[keyof typeof WorkContents];
