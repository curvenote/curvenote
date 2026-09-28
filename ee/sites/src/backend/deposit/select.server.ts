import type { Prisma } from '@curvenote/scms-db';

/** Everything a deposit reads from the DB, in one query. Not the site-work selects: those omit metadata and author_details. */
export const depositSourceSelect = {
  id: true,
  date_published: true,
  work_version: {
    select: {
      cdn: true,
      cdn_key: true,
      title: true,
      date: true,
      doi: true,
      metadata: true,
      author_details: true,
      work: { select: { doi: true } },
    },
  },
  submission: {
    select: {
      id: true,
      site_id: true,
      date_published: true,
      doi: true,
      kind: { select: { name: true, content: true, doi_content_type: true } },
      site: { select: { doiConfig: { select: { status: true, prefix: true, role: true } } } },
    },
  },
} satisfies Prisma.SubmissionVersionSelect;

export type DepositSourceRow = Prisma.SubmissionVersionGetPayload<{
  select: typeof depositSourceSelect;
}>;
