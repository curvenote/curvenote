import { isDoiContentType } from '@curvenote/scms-core';
import type { DoiContentType } from '@curvenote/scms-core';
import { kindTitle } from '../kinds.utils.js';
import type { DoiDeps, DoiTx, EligibleKindDTO } from './types.js';

type Reader = Pick<DoiDeps['prisma'], 'submissionKind'> | DoiTx;

const KIND_SELECT = { id: true, name: true, content: true, doi_content_type: true } as const;

export function dbGetSiteKinds(client: Reader, siteId: string) {
  return client.submissionKind.findMany({
    where: { site_id: siteId },
    select: KIND_SELECT,
    orderBy: { name: 'asc' },
  });
}

type SetKindContentTypeInput = { siteId: string; kindId: string; value: DoiContentType | null };

/**
 * `site_id` in the where keeps another site's kind out. A kind deleted since it was read makes
 * this throw P2025, which commitDoiWrite answers as stale.
 */
export function dbSetKindContentType(
  tx: DoiTx,
  { siteId, kindId, value }: SetKindContentTypeInput,
) {
  return tx.submissionKind.update({
    where: { id: kindId, site_id: siteId },
    data: { doi_content_type: value, date_modified: new Date().toISOString() },
    select: { id: true },
  });
}

/** The Eligible Submission Kinds card's rows, in name order. */
export async function dbListKindMappings(
  client: Reader,
  siteId: string,
): Promise<EligibleKindDTO[]> {
  const kinds = await dbGetSiteKinds(client, siteId);
  return kinds.map((kind) => ({
    id: kind.id,
    title: kindTitle(kind),
    doiContentType: isDoiContentType(kind.doi_content_type) ? kind.doi_content_type : null,
  }));
}
