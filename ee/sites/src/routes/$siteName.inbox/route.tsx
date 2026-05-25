import { withAppSiteContext } from '@curvenote/scms-server';
import {
  PageFrame,
  getBrandingFromMetaMatches,
  joinPageTitle,
  site as siteScopes,
} from '@curvenote/scms-core';
import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { formatSubmissionListingSiteContext } from '../$siteName.submissions._index/site-context.format.server.js';
import type { SubmissionListingSiteContext } from '../$siteName.submissions._index/site-context.format.server.js';
import { ClassicInboxRedirect } from './ClassicInboxRedirect.js';
import { InboxComingSoon } from './InboxComingSoon.js';

interface LoaderData {
  site: SubmissionListingSiteContext;
}

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const ctx = await withAppSiteContext(args, [siteScopes.submissions.list], {
    redirectTo: '/app',
    redirect: true,
  });

  return {
    site: formatSubmissionListingSiteContext(ctx),
  };
}

export const meta: MetaFunction<typeof loader> = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Inbox', loaderData?.site?.title, branding.title) }];
};

export default function Inbox({ loaderData }: { loaderData: LoaderData }) {
  const { site } = loaderData;

  const breadcrumbs = [
    { label: 'Sites', href: '/app/sites' },
    { label: site.title || site.name, isCurrentPage: true },
  ];

  return (
    <PageFrame
      title="Inbox"
      subtitle={`Manage the submissions inbox for ${site.title}`}
      breadcrumbs={breadcrumbs}
    >
      <InboxComingSoon siteName={site.name} />
      <ClassicInboxRedirect siteName={site.name} />
    </PageFrame>
  );
}
