import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { data } from 'react-router';
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
  getBrandingFromMetaMatches,
  joinPageTitle,
  TrackEvent,
  scopes,
} from '@curvenote/scms-core';
import { withAppSiteContext, userHasScope, assertUserDefined } from '@curvenote/scms-server';
import { loadSubmissionDetailPage } from './loader.server.js';
import type { SubmissionDetailPageData } from './loader.server.js';
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
} from './magicLinks.server.js';
import { useEffect, useState } from 'react';
import { SubmissionDetails } from './SubmissionDetails.js';
import { MagicLinks } from './MagicLinks.js';
import { GalleryHorizontalEnd, Info, MonitorPlay } from 'lucide-react';
import { SubmissionVersionTimeline } from './SubmissionVersionTimeline.js';

export const loader = async (args: LoaderFunctionArgs): Promise<SubmissionDetailPageData> => {
  const ctx = await withAppSiteContext(args, [scopes.site.submissions.read], {
    redirectTo: '/app',
    redirect: true,
  });

  const { siteName, submissionId } = args.params;
  if (!siteName) throw new Error('Missing siteName');
  if (!submissionId) throw new Error('Missing submissionId');
  if (!ctx.user) throw error401();
  if (!clientCheckSiteScopes(ctx.scopes, [scopes.site.submissions.read], siteName)) {
    throw error401();
  }

  const page = await loadSubmissionDetailPage(ctx, siteName, submissionId);
  if (page == null) throw error404();

  const { submission, submissionVersions, activeVersion } = page;

  await ctx.trackEvent(TrackEvent.SUBMISSION_VIEWED, {
    submissionId: submission.id,
    siteName: ctx.site.name,
    submissionStatus: activeVersion.status,
    workId: activeVersion.site_work.id,
    versionCount: submissionVersions.length,
    submissionKind: submission.kind.name,
    collectionName: submission.collection.name,
    workflowName: submission.collection.workflow,
  });

  await ctx.analytics.flush();

  return page;
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

export default function SubmissionDetailRoute({
  loaderData,
}: {
  loaderData: SubmissionDetailPageData;
}) {
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
    checkServiceRunsByWorkVersionId,
  } = loaderData;

  const { kind, submitted_by, date_created, date_published } = submission;
  const { title, description, authors } = activeVersion.site_work;

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
                    {kind.content.title ?? kind.name}
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
        <SectionWithHeading heading="Timeline" icon={GalleryHorizontalEnd}>
          <primitives.Card lift className="p-8">
            <SubmissionVersionTimeline
              workflow={workflow}
              submissionVersions={submissionVersions}
              activities={submission.activity}
              checkServiceRunsByWorkVersionId={checkServiceRunsByWorkVersionId}
              canUpdateStatus={canUpdateStatus}
              site={site}
              signature={signature}
            />
          </primitives.Card>
        </SectionWithHeading>
      </div>
    </PageFrame>
  );
}
