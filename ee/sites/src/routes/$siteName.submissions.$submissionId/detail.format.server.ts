import { formatDate } from '@curvenote/common';
import type { SiteContext } from '@curvenote/scms-server';
import { signPrivateUrls } from '@curvenote/scms-server';
import { coerceToObject, type WorkflowTransition } from '@curvenote/scms-core';
import { formatSiteLayoutSite } from '../$siteName/layout.format.server.js';
import { findImportantVersions } from '../$siteName.submissions._index/listing.utils.server.js';
import type {
  SubmissionDetailActivity,
  SubmissionDetailSiteContext,
  SubmissionDetailSiteWork,
  SubmissionDetailSubmission,
  SubmissionDetailVersion,
  SubmissionEditorCollection,
} from './types.js';
import type { SubmissionDetailRow, SubmissionEditorCollectionRow } from './db.server.js';

export function formatSubmissionDetailSiteContext(ctx: SiteContext): SubmissionDetailSiteContext {
  return {
    ...formatSiteLayoutSite(ctx),
    id: ctx.site.id,
  };
}

function formatDetailSiteWork(
  ctx: SiteContext,
  version: SubmissionDetailRow['versions'][number],
  submission: SubmissionDetailRow,
): SubmissionDetailSiteWork {
  const wv = version.work_version;
  const workId = wv.work_id;

  let thumbnail: string | undefined;
  if (wv.cdn && wv.cdn_key) {
    const { thumbnail: thumbnailUrl } = signPrivateUrls(
      ctx,
      { cdn: wv.cdn, key: wv.cdn_key },
      ctx.asApiUrl(`/sites/${ctx.site.name}/works/${workId}/versions/${wv.id}/thumbnail`),
      'no-social',
    );
    thumbnail = thumbnailUrl;
  }

  return {
    id: workId,
    version_id: wv.id,
    title: wv.title ?? '',
    description: wv.description ?? undefined,
    authors: wv.authors.map((name) => ({ name })),
    doi: wv.doi ?? submission.work?.doi ?? undefined,
    key: submission.work?.key ?? undefined,
    links: {
      thumbnail,
      build: version.job_id ? ctx.asBaseUrl(`/build/${version.job_id}`) : undefined,
    },
  };
}

function formatDetailVersion(
  ctx: SiteContext,
  version: SubmissionDetailRow['versions'][number],
  submission: SubmissionDetailRow,
): SubmissionDetailVersion {
  const siteWork = formatDetailSiteWork(ctx, version, submission);
  return {
    id: version.id,
    date_created: formatDate(version.date_created),
    date_published: version.date_published ?? undefined,
    status: version.status,
    transition: version.transition == null ? undefined : (version.transition as WorkflowTransition),
    submitted_by: {
      id: version.submitted_by.id,
      name: version.submitted_by.display_name ?? '',
    },
    site_work: siteWork,
    links: { build: siteWork.links.build },
  };
}

function formatDetailActivity(
  ctx: SiteContext,
  activity: SubmissionDetailRow['activity'][number],
): SubmissionDetailActivity {
  const data = coerceToObject(activity.data);
  const jobFailure =
    data?.transition_cancelled === true && typeof data.error === 'string'
      ? {
          error: data.error,
          job_id: typeof data.job_id === 'string' ? data.job_id : undefined,
          job_type: typeof data.job_type === 'string' ? data.job_type : undefined,
          build_url:
            typeof data.job_id === 'string' ? ctx.asBaseUrl(`/build/${data.job_id}`) : undefined,
        }
      : undefined;

  return {
    id: activity.id,
    date_created: formatDate(activity.date_created),
    activity_by: { name: activity.activity_by.display_name ?? '' },
    activity_type: activity.activity_type,
    status: activity.status ?? undefined,
    kind: activity.kind?.name,
    submission_version: activity.submission_version
      ? {
          id: activity.submission_version.id,
          date_created: formatDate(activity.submission_version.date_created),
        }
      : undefined,
    date_published: activity.date_published ?? undefined,
    job_failure: jobFailure,
  };
}

export function formatSubmissionDetailSubmission(
  ctx: SiteContext,
  row: SubmissionDetailRow,
): { submission: SubmissionDetailSubmission; versions: SubmissionDetailVersion[] } {
  const idx = findImportantVersions(row.versions);
  const activeVersion = row.versions[idx.active ?? idx.published ?? 0];
  const publishedVersion = idx.published !== undefined ? row.versions[idx.published] : undefined;
  const retractedVersion = idx.retracted !== undefined ? row.versions[idx.retracted] : undefined;

  const kindContent = coerceToObject(row.kind.content);
  const collectionContent = coerceToObject(row.collection.content);
  const slug = row.slugs.find((s) => s.primary)?.slug ?? row.slugs[0]?.slug ?? undefined;

  const submission: SubmissionDetailSubmission = {
    id: row.id,
    date_created: formatDate(row.date_created),
    date_published: row.date_published ?? undefined,
    slug,
    kind: {
      id: row.kind.id,
      name: row.kind.name,
      content: kindContent,
    },
    collection: {
      id: row.collection.id,
      name: row.collection.name,
      workflow: row.collection.workflow,
      content: collectionContent,
    },
    submitted_by: {
      id: row.submitted_by.id,
      name: row.submitted_by.display_name ?? '',
    },
    active_version_id: activeVersion?.id,
    published_version_id: publishedVersion?.id,
    retracted_version_id: retractedVersion?.id,
    activity: row.activity.map((activity) => formatDetailActivity(ctx, activity)),
  };

  const versions = row.versions.map((v) => formatDetailVersion(ctx, v, row));

  return { submission, versions };
}

export function formatSubmissionEditorCollections(
  rows: SubmissionEditorCollectionRow[],
): SubmissionEditorCollection[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    content: coerceToObject(row.content),
    kinds: row.kindsInCollection.map(({ kind }) => ({
      id: kind.id,
      name: kind.name,
      content: coerceToObject(kind.content),
      default: kind.default,
    })),
  }));
}
