import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { data } from 'react-router';
import {
  clientCheckSiteScopes,
  error401,
  error404,
  PageFrame,
  useRevalidateOnInterval,
  useDeploymentConfig,
  getBrandingFromMetaMatches,
  joinPageTitle,
  TrackEvent,
  scopes,
} from '@curvenote/scms-core';
import { withAppSiteContext, userHasScope, assertUserDefined } from '@curvenote/scms-server';
import { formatPublicationDate } from '../../publicationDateCalendar.js';
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
import { SubmissionSummaryCard } from './SubmissionSummaryCard.js';
import { SubmissionMediaSection } from './SubmissionMediaSection.js';
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
    checkServiceRunsByWorkVersionId,
    mediaThumbnailUrl,
  } = loaderData;

  const { date_published } = submission;
  const { title, description, authors, doi } = activeVersion.site_work;

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

  const publishedOn = date_published
    ? `Published on ${formatPublicationDate(date_published)}`
    : undefined;

  return (
    <PageFrame breadcrumbs={breadcrumbs}>
      <div className="mt-4 space-y-6 md:space-y-10">
        <SubmissionSummaryCard
          title={title}
          description={description}
          authors={authors}
          publishedOn={publishedOn}
          doi={doi}
        />
        <SubmissionMediaSection thumbnailUrl={mediaThumbnailUrl} title={title} />
        <SubmissionDetails baseUrl={config.renderServiceUrl ?? site.links.html} />
        <MagicLinks />
        <SubmissionVersionTimeline
          workflow={workflow}
          submissionVersions={submissionVersions}
          activities={submission.activity}
          checkServiceRunsByWorkVersionId={checkServiceRunsByWorkVersionId}
          canUpdateStatus={canUpdateStatus}
          site={site}
          signature={signature}
        />
      </div>
    </PageFrame>
  );
}
