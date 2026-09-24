import type { DoiContentType } from '@curvenote/scms-core';
import { LIVE_REGISTRATION_STATUSES } from './db.server.js';
import type { DoiDeps, DoiTx } from './types.js';

type Reader = Pick<DoiDeps['prisma'], 'submissionKind' | 'submission'> | DoiTx;

const KIND_SELECT = { id: true, name: true, content: true, doi_content_type: true } as const;

export function dbGetSiteKinds(client: Reader, siteId: string) {
  return client.submissionKind.findMany({
    where: { site_id: siteId },
    select: KIND_SELECT,
    orderBy: { name: 'asc' },
  });
}

type LiveKindsFilter = { siteId: string; kindIds?: string[] };

/**
 * Kinds with a submission whose DOI Crossref holds or is receiving. Those DOIs were deposited as
 * the kind's content type, so it cannot change under them. A FAILED registration locks nothing.
 */
export async function dbKindIdsWithLiveRegistrations(
  client: Reader,
  { siteId, kindIds }: LiveKindsFilter,
) {
  const rows = await client.submission.findMany({
    where: {
      site_id: siteId,
      ...(kindIds ? { kind_id: { in: kindIds } } : {}),
      doiRegistration: { is: { status: { in: LIVE_REGISTRATION_STATUSES } } },
    },
    select: { kind_id: true },
    distinct: ['kind_id'],
  });
  return new Set(rows.map((row) => row.kind_id));
}

type SetKindContentTypeInput = { siteId: string; kindId: string; value: DoiContentType | null };

/** `site_id` in the where keeps another site's kind out. False when nothing matched. */
export async function dbSetKindContentType(
  tx: DoiTx,
  { siteId, kindId, value }: SetKindContentTypeInput,
) {
  const { count } = await tx.submissionKind.updateMany({
    where: { id: kindId, site_id: siteId },
    data: {
      doi_content_type: value,
      date_modified: new Date().toISOString(),
      occ: { increment: 1 },
    },
  });
  return count === 1;
}
