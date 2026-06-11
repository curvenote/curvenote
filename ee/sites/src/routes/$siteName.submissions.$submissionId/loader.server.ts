import type { Context, Workflow } from '@curvenote/scms-core';
import {
  createPreviewToken,
  getConfiguredWorkflow,
  type SiteContext,
} from '@curvenote/scms-server';
import {
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
import type {
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
};

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
    siteName,
    submissionId,
    ctx.$config.api.previewIssuer,
    ctx.$config.api.previewSigningSecret,
  );

  const [siteWithAppData, slugs, poll, magicLinks] = await Promise.all([
    dbGetSiteAppData(siteName),
    dbListSubmissionSlugRows(submissionId),
    dbShouldPollSubmissionVersions(
      ctx.site.id,
      submissionVersions.map((v) => v.id),
    ),
    dbListMagicLinksForSubmission(submissionId),
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

  if (!ctx.user) {
    return null;
  }

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
  };
}
