import type { TagDTO } from '@curvenote/common';
import { scopes } from '@curvenote/scms-core';
import type { Context, TimelineCheckServiceRunRow, Workflow } from '@curvenote/scms-core';
import {
  createPreviewToken,
  getConfiguredWorkflow,
  resolveWorkVersionCdnMedia,
  sites,
  userHasScope,
  userHasSiteScope,
  type SiteContext,
  type WorkVersionCdnMedia,
} from '@curvenote/scms-server';
import { loadDoiReadiness } from '../../backend/deposit/readiness.server.js';
import type { DoiReadiness } from '../../backend/deposit/readiness.server.js';
import {
  dbGetSubmissionCheckServiceRunsByWorkVersionIds,
  dbGetSiteAppData,
  dbListMagicLinksForSubmission,
  dbListSubmissionSlugRows,
  dbLoadSubmissionDetail,
  dbShouldPollSubmissionVersions,
} from './db.server.js';
import {
  formatSubmissionDetailSiteContext,
  formatSubmissionDetailSubmission,
  formatSubmissionEditorCollections,
} from './detail.format.server.js';
import { loadDoiRegistrationView } from './doiRegistration.server.js';
import type {
  DoiRegistrationView,
  MagicLinkWithAccessCount,
  SiteWithAppData,
  SubmissionDetailSiteContext,
  SubmissionDetailSlugRow,
  SubmissionDetailSubmission,
  SubmissionDetailVersion,
  SubmissionEditorCollection,
} from './types.js';

export type SubmissionDetailPageData = {
  user: Context['user'];
  userScopes: string[];
  site: SubmissionDetailSiteContext;
  siteWithAppData: SiteWithAppData;
  submission: SubmissionDetailSubmission;
  submissionVersions: SubmissionDetailVersion[];
  signature: string;
  slugs: SubmissionDetailSlugRow[];
  collections: SubmissionEditorCollection[];
  workflow: Workflow;
  poll: boolean;
  activeVersion: SubmissionDetailVersion;
  activeVersionNumber: number;
  magicLinks: MagicLinkWithAccessCount[];
  checkServiceRunsByWorkVersionId: Record<string, TimelineCheckServiceRunRow[]>;
  /** SSR-safe thumbnail URL for MEDIA (resolved via column or CDN config). */
  mediaThumbnailUrl: string | undefined;
  /** Active work version CDN config.json (null when no CDN); for MEDIA and upcoming sections. */
  activeVersionCdnConfig: WorkVersionCdnMedia['cdnConfig'];
  siteTags: TagDTO[];
  /**
   * Streamed, not awaited: the check reads the CDN. Null when the viewer lacks site:doi:read or
   * the per-user DOI preview flag, when the work already has a DOI, or when a registration
   * already exists (its own state takes over the DOI row).
   */
  doiReadiness: Promise<DoiReadiness> | null;
  /**
   * The submission's DOI registration state (in progress / resubmitting / unsuccessful /
   * registered), when one exists. Null when the viewer can't see DOI registration, the work
   * already has a DOI, or there is no registration row in a shown state.
   */
  doiRegistration: DoiRegistrationView | null;
  /** Whether the viewer may register or retry a DOI: site.doi.register plus the feature flag. */
  canRegisterDoi: boolean;
};

/**
 * Starts the DOI readiness check without awaiting it, so the page streams it in. Null when the
 * work already has a DOI, a registration already exists, or the viewer can't see DOI
 * registration.
 */
function startDoiReadiness(
  ctx: SiteContext,
  submissionId: string,
  activeVersion: SubmissionDetailVersion,
  canSeeDoi: boolean,
  doiRegistration: DoiRegistrationView | null,
): Promise<DoiReadiness> | null {
  if (!canSeeDoi || activeVersion.site_work.doi || doiRegistration) {
    return null;
  }
  return loadDoiReadiness(ctx, submissionId);
}

export async function loadSubmissionDetailPage(
  ctx: SiteContext,
  siteName: string,
  submissionId: string,
): Promise<SubmissionDetailPageData | null> {
  const loaded = await dbLoadSubmissionDetail(ctx, submissionId);
  if (loaded == null) {
    return null;
  }

  const site = formatSubmissionDetailSiteContext(ctx);
  const { submission, versions: submissionVersions } = formatSubmissionDetailSubmission(
    ctx,
    loaded.submission,
  );
  const collections = formatSubmissionEditorCollections(loaded.collections);

  const signature = createPreviewToken(
    submissionId,
    ctx.$config.api.previewIssuer,
    ctx.$config.api.previewSigningSecret,
  );

  const [siteWithAppData, slugs, poll, magicLinks, checkServiceRunsByWorkVersionId, siteTags] =
    await Promise.all([
      dbGetSiteAppData(siteName),
      dbListSubmissionSlugRows(submissionId),
      dbShouldPollSubmissionVersions(
        ctx.site.id,
        submissionVersions.map((v) => v.id),
      ),
      dbListMagicLinksForSubmission(submissionId),
      dbGetSubmissionCheckServiceRunsByWorkVersionIds(
        submissionVersions.map((version) => version.site_work.version_id),
      ),
      sites.tags.dbListSiteTags(ctx.site.id),
    ]);

  if (!siteWithAppData) {
    return null;
  }

  const workflow = getConfiguredWorkflow(ctx, submission.collection.workflow);

  let activeVersionIndex = submissionVersions.findIndex(
    (version) => version.id === submission.active_version_id,
  );
  if (activeVersionIndex === -1) activeVersionIndex = 0;
  const activeVersionNumber = submissionVersions.length - activeVersionIndex;
  const activeVersion = submissionVersions[activeVersionIndex];

  const rawActiveVersion =
    loaded.submission.versions.find((version) => version.id === activeVersion.id) ??
    loaded.submission.versions[0];
  const { mediaThumbnailUrl, cdnConfig: activeVersionCdnConfig } = await resolveWorkVersionCdnMedia(
    ctx,
    siteName,
    rawActiveVersion.work_version,
  );

  if (!ctx.user) {
    return null;
  }

  const canSeeDoi =
    userHasSiteScope(ctx.user, scopes.site.doi.read, ctx.site.id) &&
    userHasScope(ctx.user, scopes.app.sites.doi.feature);
  const canRegisterDoi =
    canSeeDoi && userHasSiteScope(ctx.user, scopes.site.doi.register, ctx.site.id);
  const doiRegistration = canSeeDoi
    ? await loadDoiRegistrationView(ctx.site.id, submissionId)
    : null;

  return {
    user: ctx.user,
    userScopes: ctx.scopes,
    site,
    siteWithAppData,
    submission,
    submissionVersions,
    signature,
    slugs,
    collections,
    workflow,
    poll,
    activeVersion,
    activeVersionNumber,
    magicLinks,
    checkServiceRunsByWorkVersionId,
    mediaThumbnailUrl,
    activeVersionCdnConfig,
    siteTags,
    doiReadiness: startDoiReadiness(ctx, submissionId, activeVersion, canSeeDoi, doiRegistration),
    doiRegistration,
    canRegisterDoi,
  };
}
