import { coerceToObject, getWorkflow } from '@curvenote/scms-core';
import { doi as doiUtils } from 'doi-utils';
import type { SiteContext } from '@curvenote/scms-server';
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
export function formatSubmissionsIndexItems(
  ctx: SiteContext,
  rows: IndexListingRow[],
): SubmissionsIndexItem[] {
  return rows.map((row) => {
    const newestVersion = row.versions[0];
    const work = newestVersion?.work_version;
    const kindContent = coerceToObject(row.kind.content);
    const collectionContent = coerceToObject(row.collection.content);
    const status = newestVersion?.status ?? 'UNKNOWN';
    const workflow = getWorkflow(ctx.$config, [], row.collection.workflow);

    return {
      id: row.id,
      title: work?.title ?? '',
      authors: (work?.authors ?? [])
        .filter((name) => typeof name === 'string' && name.trim().length > 0)
        .map((name) => ({ name })),
      datePublished: row.date_published ?? undefined,
      dateFirstSubmitted: row.date_created,
      dateLastUpdated: row.activity[0]?.date_created ?? row.date_created,
      doi: doiUtils.normalize(work?.doi ?? row.work?.doi),
      status,
      statusLabel: workflow.states[status]?.label ?? status,
      publishedVersion: row.publishedVersion,
      retractedVersion: row.retractedVersion,
      kind: {
        id: row.kind.id,
        name: row.kind.name,
        content: kindContent,
      },
      collection: {
        id: row.collection.id,
        name: row.collection.name,
        slug: row.collection.slug,
        workflow: row.collection.workflow,
        open: row.collection.open,
        content: collectionContent,
      },
    };
  });
}
