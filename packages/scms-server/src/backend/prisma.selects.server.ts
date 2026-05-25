import type { Prisma } from '@curvenote/scms-db';

/** WorkVersion scalars used by formatSiteWorkDTO, formatWorkDTO, and WorkContext (excludes metadata). */
export const siteWorkWorkVersionSelect = {
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
  date: true,
  draft: true,
  occ: true,
} satisfies Prisma.WorkVersionSelect;

/** Work details route: version scalars + submission graph (excludes metadata JSON). */
export const workDetailsWorkVersionSelect = {
  ...siteWorkWorkVersionSelect,
  date_modified: true,
  author_details: true,
} satisfies Prisma.WorkVersionSelect;

/** WorkVersion + work for site-work DTOs that fall back to work.doi/key. */
export const siteWorkWorkVersionWithWorkSelect = {
  ...siteWorkWorkVersionSelect,
  work: { select: { id: true, doi: true, key: true } },
} satisfies Prisma.WorkVersionSelect;

/** CDN / storage admin paths (excludes metadata). */
export const cdnWorkVersionSelect = {
  id: true,
  work_id: true,
  cdn: true,
  cdn_key: true,
} satisfies Prisma.WorkVersionSelect;

/** Activity feed refs — avoid full version payloads. */
export const activitySubmissionVersionRefSelect = {
  id: true,
  date_created: true,
} satisfies Prisma.SubmissionVersionSelect;

export const activityWorkVersionRefSelect = {
  id: true,
  date_created: true,
} satisfies Prisma.WorkVersionSelect;
