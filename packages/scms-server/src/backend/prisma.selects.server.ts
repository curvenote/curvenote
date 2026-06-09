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
 * Minimal select for rows formatted *only* by `formatSiteWorkDTO` (the public
 * site-work DTO). Same relation shape as `submissionVersionForSiteWorkSelect`
 * so the nested summary formatters still type-check, but drops the
 * SubmissionVersion-level bookkeeping the DTO never reads — `status`,
 * `transition`, `job_id`, `work_version_id`, the version-level `date_*`, and
 * crucially `submitted_by` (which otherwise pulls a whole `User` row).
 *
 * Use this for endpoints that resolve a single site-work and run it straight
 * through `formatSiteWorkDTO` (e.g. `sites.doi`). Endpoints that also build a
 * `SubmissionVersionDTO` (versions list/get) need the broader select above.
 */
export const siteWorkDtoSelect = {
  id: true,
  tags: true,
  work_version: { select: siteWorkWorkVersionSelect },
  submission: {
    select: {
      id: true,
      site_id: true,
      date_published: true,
      kind: true,
      collection: true,
      slugs: true,
      work: true,
    },
  },
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
      site_id: true,
      date_published: true,
      kind: true,
      collection: true,
      slugs: true,
      work: true,
    },
  },
} satisfies Prisma.SubmissionVersionSelect;
