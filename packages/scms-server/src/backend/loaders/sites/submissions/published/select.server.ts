import type { Prisma } from '@curvenote/scms-db';
import { siteWorkDtoSelect, siteWorkSubmissionSelect } from '../../../../prisma.selects.server.js';

/**
 * `siteWorkDtoSelect` plus the editorial tags of the submission.
 *
 * Only `GET /v1/sites/:siteName/works/:workIdOrSlug/published` uses this. The
 * shared selects stay narrow so the DOI and listing endpoints keep their
 * current payload and query cost.
 */
export const publishedSiteWorkWithTagsSelect = {
  ...siteWorkDtoSelect,
  submission: {
    select: {
      ...siteWorkSubmissionSelect,
      tags: {
        select: { tag: { select: { id: true, name: true, label: true } } },
        orderBy: { tag: { label: 'asc' } },
      },
    },
  },
} satisfies Prisma.SubmissionVersionSelect;

export type PublishedSiteWorkWithTagsRow = Prisma.SubmissionVersionGetPayload<{
  select: typeof publishedSiteWorkWithTagsSelect;
}>;
