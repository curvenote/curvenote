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

/**
 * Submission versions on list/get submission APIs (excludes submission-version metadata JSON).
 */
export const submissionVersionForListSelect = {
  id: true,
  date_created: true,
  date_published: true,
  status: true,
  job_id: true,
  transition: true,
  tags: true,
  work_version_id: true,
  submitted_by: { select: { id: true, display_name: true } },
  work_version: { select: siteWorkWorkVersionWithWorkSelect },
} satisfies Prisma.SubmissionVersionSelect;

/**
 * Submission version rows formatted as SiteWorkDTO / SubmissionVersionDTO
 * (excludes submission-version metadata JSON).
 */
export const submissionVersionForSiteWorkSelect = {
  id: true,
  date_created: true,
  date_published: true,
  status: true,
  transition: true,
  job_id: true,
  work_version_id: true,
  tags: true,
  submitted_by: { select: { id: true, display_name: true } },
  work_version: { select: siteWorkWorkVersionSelect },
  submission: {
    select: {
      id: true,
      date_published: true,
      kind: true,
      collection: true,
      slugs: true,
      work: true,
    },
  },
} satisfies Prisma.SubmissionVersionSelect;
