export type WorkVersionForNumbering = {
  id: string;
  date_created: string;
};

/** Newest work version first (by `date_created`). */
export function compareWorkVersionsByDateCreatedDesc(
  a: WorkVersionForNumbering,
  b: WorkVersionForNumbering,
): number {
  if (a.date_created === b.date_created) return 0;
  return a.date_created > b.date_created ? -1 : 1;
}

/**
 * Assign v1 to the oldest version by `date_created`, vN to the newest.
 * Returns a map of version id → 1-based version number.
 */
export function buildWorkVersionNumberByIdMap(
  versions: readonly WorkVersionForNumbering[],
): Record<string, number> {
  const sorted = [...versions].sort(compareWorkVersionsByDateCreatedDesc);
  const map: Record<string, number> = {};
  sorted.forEach((version, index) => {
    map[version.id] = versions.length - index;
  });
  return map;
}

/** Version number when versions are already ordered newest-first. */
export function workVersionNumberAtNewestFirstIndex(index: number, totalCount: number): number {
  return totalCount - index;
}
