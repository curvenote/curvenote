import { doi as doiUtils } from 'doi-utils';
import type { IndexListingRow } from './db.server.js';
import type { SubmissionsIndexItem } from './types.js';

/**
 * The listing card uses the newest version's title and authors.
 *
 * `is_listed = true` guarantees that the newest version is not DRAFT/INCOMPLETE,
 * so the card never surfaces unfinished content. Submissions whose newest
 * version is RETRACTED / UNPUBLISHED / REJECTED / IN_REVIEW intentionally
 * surface that current-state title/authors rather than reaching back to the
 * last PUBLISHED version (which is what the classic listing did). For the
 * common case the two listings agree.
 */
export function formatSubmissionsIndexItems(rows: IndexListingRow[]): SubmissionsIndexItem[] {
  return rows.map((row) => {
    const work = row.versions[0]?.work_version;
    return {
      id: row.id,
      title: work?.title ?? '',
      authors: (work?.authors ?? [])
        .filter((name) => typeof name === 'string' && name.trim().length > 0)
        .map((name) => ({ name })),
      datePublished: row.date_published ?? undefined,
      doi: doiUtils.normalize(work?.doi ?? row.work?.doi),
    };
  });
}
