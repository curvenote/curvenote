import type { Prisma } from '@curvenote/scms-db';

/**
 * The exact set of columns/relations the public submission listing query reads.
 * Narrower than the shared `submissionVersionForSiteWorkSelect`: it drops
 * `submitted_by` (unused → removes a whole query), version bookkeeping columns
 * (`status`, `transition`, `job_id`, `date_*`), `kind.checks`, `work.contains`,
 * and `work_version.{draft,occ,date}`, and fetches only the primary slug.
 *
 * Shared by site `/works` and cross-site `/submissions` listing queries; each
 * endpoint keeps its own formatter co-located with the route.
 */
export const siteWorkListingSelect = {
  id: true,
  tags: true,
  work_version: {
    select: {
      id: true,
      work_id: true,
      cdn: true,
      cdn_key: true,
      title: true,
      description: true,
      authors: true,
      tags: true,
      doi: true,
      canonical: true,
      date_created: true,
    },
  },
  submission: {
    select: {
      id: true,
      site_id: true,
      date_published: true,
      kind: { select: { id: true, name: true, content: true, default: true } },
      collection: {
        select: { id: true, name: true, slug: true, workflow: true, content: true, open: true },
      },
      slugs: { where: { primary: true }, select: { slug: true, primary: true }, take: 1 },
      work: { select: { doi: true, key: true } },
    },
  },
} satisfies Prisma.SubmissionVersionSelect;

/**
 * A single listing row, as selected by `siteWorkListingSelect` and consumed by
 * endpoint formatters.
 */
export type SubmissionListingRowDBO = Prisma.SubmissionVersionGetPayload<{
  select: typeof siteWorkListingSelect;
}>;

/** The shape returned by the shared listing DB layer in `listing-db.server.ts`. */
export type SubmissionListingDBO = { items: SubmissionListingRowDBO[]; total: number };
