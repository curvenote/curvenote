import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { data } from 'react-router';
import type { Context, Workflow } from '@curvenote/scms-core';
import {
  primitives,
  clientCheckSiteScopes,
  error401,
  error404,
  formatDate,
  PageFrame,
  useRevalidateOnInterval,
  SectionWithHeading,
  useDeploymentConfig,
  getWorkflow,
  getBrandingFromMetaMatches,
  joinPageTitle,
  TrackEvent,
  KnownJobTypes,
  scopes,
} from '@curvenote/scms-core';
import {
  withAppSiteContext,
  userHasScope,
  createPreviewToken,
  sites,
  jobs,
  getPrismaClient,
  assertUserDefined,
} from '@curvenote/scms-server';
import {
  actionAddSlug,
  actionDeleteSlug,
  actionSetCollection,
  actionSetKind,
  actionSetPrimarySlug,
  actionUpdateDatePublished,
} from './actionHelpers.server.js';
import {
  actionCreateMagicLink,
  actionRevokeMagicLink,
  actionReactivateMagicLink,
  actionDeleteMagicLink,
  loadMagicLinks,
} from './magicLinks.server.js';
import type { Slug } from '@prisma/client';
import { JobStatus } from '@prisma/client';
import { useEffect, useState } from 'react';
import { ActivityFeed } from './ActivityFeed.js';
import { Versions } from './Versions.js';
import { SubmissionDetails } from './SubmissionDetails.js';
import { MagicLinks } from './MagicLinks.js';
import { Info, MonitorPlay } from 'lucide-react';
import { getSiteWithAppData } from '../../backend/db.server.js';
import type { SiteWithAppData } from '../../backend/db.server.js';
import type {
  SubmissionVersionDTO,
  SiteDTO,
  SubmissionDTO,
  CollectionListingDTO,
} from '@curvenote/common';

// TODO: Move to Prisma schema once magic-link.prisma is added to this workspace
interface MagicLink {
  id: string;
  date_created: string;
  date_modified: string;
  created_by_id: string;
  type: string;
  data: any;
  expiry: string | null;
  revoked: boolean;
  access_limit: number | null;
}

interface MagicLinkWithCount extends MagicLink {
  access_count: number;
}

interface LoaderData {
  user: Context['user'];
  userScopes: string[];
  site: SiteDTO;
  siteWithAppData: SiteWithAppData;
  submission: SubmissionDTO;
  submissionVersions: SubmissionVersionDTO[];
  signature: string;
  slugs: Slug[];
  collections: CollectionListingDTO;
  workflow: Workflow;
  poll: boolean;
  activeVersion: SubmissionVersionDTO;
  activeVersionNumber: number;
  magicLinks: MagicLinkWithCount[];
}

export const loader = async (args: LoaderFunctionArgs): Promise<LoaderData> => {
  const ctx = await withAppSiteContext(args, [scopes.site.submissions.read], {
    redirectTo: '/app',
    redirect: true,
  });

  // TODO use loadSubmission!!
  const { siteName, submissionId } = args.params;
  if (!siteName) throw new Error('Missing siteName');
  if (!submissionId) throw new Error('Missing siteName');
  if (!ctx.user) throw error401();
  if (!clientCheckSiteScopes(ctx.scopes, [scopes.site.submissions.read], siteName))
    throw error401();

  const submission = await sites.submissions.get(ctx, submissionId, []);
  if (submission == null) throw error404();

  const signature = createPreviewToken(
    siteName,
    submissionId,
    ctx.$config.api.previewIssuer,
    ctx.$config.api.previewSigningSecret,
  );

  // Get site with app-specific data (not exposed via public API)
  const siteWithAppData = await getSiteWithAppData(siteName);
  if (!siteWithAppData) throw error404('Site not found');

  // Keep ctx.siteDTO for API-compatible site information
  const site = ctx.siteDTO;
  const collections = await sites.collections.list(ctx, {});

  const prisma = await getPrismaClient();
  const slugs = await prisma.slug.findMany({
    where: {
      submission_id: args.params.submissionId,
    },
    orderBy: [{ date_created: 'desc' }],
  });

  // TODO Good for now, probably will be removed when we go remix v2
  const jobsQuery = jobs.list(
    ctx,
    ctx.site.id,
    [KnownJobTypes.PUBLISH, KnownJobTypes.UNPUBLISH],
    [JobStatus.RUNNING],
  );

  const [submissionVersions, jobsListing, magicLinks] = await Promise.all([
    sites.submissions.versions.list(ctx, submissionId),
    jobsQuery,
    loadMagicLinks(submissionId),
  ]);

  const poll =
    jobsListing.items.length > 0 &&
    jobsListing.items.find((job: any) => {
      const payload = job.payload as { submission_version_id: string };
      return submissionVersions.items
        .map((v: SubmissionVersionDTO) => v.id)
        .includes(payload.submission_version_id);
    }) !== undefined;

  const workflow = getWorkflow(ctx.$config, [], submission.collection.workflow);

  let activeVersionIndex = submissionVersions.items.findIndex(
    (version: SubmissionVersionDTO) => version.id === submission.active_version_id,
  );
  if (activeVersionIndex === -1) activeVersionIndex = 0;
  const activeVersionNumber = submissionVersions.items.length - activeVersionIndex;
  const activeVersion = submissionVersions.items[activeVersionIndex];

  await ctx.trackEvent(TrackEvent.SUBMISSION_VIEWED, {
    submissionId: submission.id,
    siteName: ctx.site.name,
    submissionStatus: activeVersion.status,
    workId: activeVersion.site_work.id,
    versionCount: submissionVersions.items.length,
    submissionKind: typeof submission.kind === 'string' ? submission.kind : submission.kind.name,
    collectionName: submission.collection.name,
    workflowName: submission.collection.workflow,
  });

  await ctx.analytics.flush();

  return {
    user: ctx.user,
    userScopes: ctx.scopes,
    site,
    siteWithAppData,
    submission,
    submissionVersions: submissionVersions.items,
    signature,
    slugs,
    collections,
    workflow,
    poll,
    activeVersion,
    activeVersionNumber,
    magicLinks,
  };
};

export async function action(args: ActionFunctionArgs) {
  const ctx = await withAppSiteContext(args, [scopes.site.submissions.update]);

  assertUserDefined(ctx.user);

  if (!userHasScope(ctx.user, scopes.site.submissions.update, ctx.site.name)) {
    return data(
      { message: 'unauthorized', error: 'current user cannot change slug' },
      { status: 401 },
    );
  }
  const formData = await args.request.formData();
  const formAction = formData.get('formAction') as string | null;
  if (typeof formAction !== 'string' || formAction.length === 0) {
    return data({ error: 'Form action not set' }, { status: 400 });
  }

  if (formAction === 'slug-remove') {
    return actionDeleteSlug(ctx, args, formData);
  } else if (formAction === 'slug-add') {
    return actionAddSlug(ctx, args, formData);
  } else if (formAction === 'slug-set-primary') {
    return actionSetPrimarySlug(ctx, args, formData);
  } else if (formAction === 'set-kind') {
    return actionSetKind(ctx, args, formData);
  } else if (formAction === 'set-collection') {
    return actionSetCollection(ctx, args, formData);
  } else if (formAction === 'set-date-published') {
    return actionUpdateDatePublished(ctx, args, formData, ctx.user.id);
  } else if (formAction === 'magic-link-create') {
    return actionCreateMagicLink(ctx, args, formData);
  } else if (formAction === 'magic-link-revoke') {
    return actionRevokeMagicLink(ctx, args, formData);
  } else if (formAction === 'magic-link-reactivate') {
    return actionReactivateMagicLink(ctx, args, formData);
  } else if (formAction === 'magic-link-delete') {
    return actionDeleteMagicLink(ctx, args, formData);
  }

  return null;
}

export const meta: MetaFunction<typeof loader> = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [
    {
      title: joinPageTitle(
        loaderData?.activeVersion.site_work.title,
        'Submission Details',
        loaderData?.site.title,
        branding.title,
      ),
    },
  ];
};

export default function SubmissionDetailRoute({ loaderData }: { loaderData: LoaderData }) {
  const config = useDeploymentConfig();
  const {
    userScopes,
    submission,
    submissionVersions,
    site,
    signature,
    workflow,
    poll,
    activeVersion,
    activeVersionNumber,
  } = loaderData;

  const { kind, submitted_by, date_created, date_published } = submission;
  const { title, description, authors } = activeVersion.site_work;

  // POLLING for status changes
  const [enabled, setEnabled] = useState(poll);
  useRevalidateOnInterval({ enabled, interval: 1000 });
  useEffect(() => {
    setEnabled(poll);
  }, [poll]);

  const canUpdateStatus = clientCheckSiteScopes(
    userScopes,
    [scopes.site.submissions.update],
    site.name,
  );

  const breadcrumbs = [
    { label: 'Sites', href: '/app/sites' },
    { label: site.title || site.name, href: `/app/sites/${site.name}/inbox` },
    { label: 'Submissions', href: `/app/sites/${site.name}/submissions` },
    { label: title || submission.id, isCurrentPage: true },
  ];

  return (
    <PageFrame
      title={
        <>
          Submission: <strong>{title}</strong>
        </>
      }
      subtitle={`Manage the details for the submission to ${site.title}`}
      breadcrumbs={breadcrumbs}
    >
      <div className="mt-4 space-y-6 md:space-y-12">
        <SectionWithHeading className="" heading="Social Media Card" icon={MonitorPlay}>
          <primitives.Card lift className="p-8">
            <div className="space-y-1">
              <div className="flex relative flex-col pt-2 space-x-4 space-y-2 md:flex-row md:space-y-0">
                <div>
                  <primitives.Thumbnail
                    className="min-w-[300px] min-h-[220px]"
                    src={activeVersion.site_work.links.thumbnail}
                    alt={title ?? ''}
                  />
                </div>
                <div className="flex flex-col">
                  <div className="font-light small-caps" title="kind">
                    {typeof kind === 'string' ? kind : (kind.content.title ?? kind.name)}
                  </div>
                  <h3 title="submission title">{title}</h3>
                  <p title="submission description" className="text-sm">
                    {description}
                  </p>
                  <div className="text-sm font-light pointer-events-none">
                    {authors?.map((a) => a.name).join(', ') ?? ''}
                  </div>
                  <div className="text-sm font-light pointer-events-none">
                    Publication Date: {date_published ? formatDate(date_published) : 'not set'}
                  </div>
                  <div className="grow"></div>
                  <div className="absolute -top-4 -right-4">
                    <primitives.HoverCardWrapper
                      content={
                        <p className="text-sm font-light text-gray-500">
                          First submitted by {submitted_by.name} on{' '}
                          {formatDate(date_created, 'MMMM dd, y')} at{' '}
                          {formatDate(date_created, 'HH:mm')} - this summary is based on version #
                          {activeVersionNumber}.
                        </p>
                      }
                    >
                      <Info className="w-4 h-4 text-gray-400" />
                    </primitives.HoverCardWrapper>
                  </div>
                </div>
              </div>
            </div>
          </primitives.Card>
        </SectionWithHeading>
        <SubmissionDetails baseUrl={config.renderServiceUrl ?? site.links.html} />
        <MagicLinks />
        <Versions
          workflow={workflow}
          submissionVersions={submissionVersions}
          canUpdateStatus={canUpdateStatus}
          site={site}
          signature={signature}
        />
        <ActivityFeed submission={submission} />
      </div>
    </PageFrame>
  );
}
