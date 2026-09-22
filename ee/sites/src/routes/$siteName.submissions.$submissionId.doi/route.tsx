import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { redirect } from 'react-router';
import {
  PageFrame,
  error404,
  getBrandingFromMetaMatches,
  joinPageTitle,
  scopes,
  ui,
} from '@curvenote/scms-core';
import { userHasScope, withAppSiteContext } from '@curvenote/scms-server';
import { loadSubmissionDoiPage } from './loader.server.js';
import type { SubmissionDoiPageData } from './loader.server.js';
import { DoiReadinessCard } from './DoiReadinessCard.js';
import { DoiPreviewCard } from './DoiPreviewCard.js';

/** Members hold site:doi:read; the per-user preview flag keeps the page out of sites not in the preview (same gate as Site > DOI Registration). */
export async function loader(args: LoaderFunctionArgs): Promise<SubmissionDoiPageData> {
  const ctx = await withAppSiteContext(args, [scopes.site.doi.read], {
    redirectTo: '/app',
    redirect: true,
  });
  if (!userHasScope(ctx.user, scopes.app.sites.doi.feature)) {
    throw redirect('/app');
  }
  const { submissionId } = args.params;
  if (!submissionId) {
    throw error404();
  }
  const page = await loadSubmissionDoiPage(ctx, submissionId);
  if (!page) {
    throw error404();
  }
  return page;
}

export const meta: MetaFunction<typeof loader> = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [
    {
      title: joinPageTitle(
        loaderData?.submission.title,
        'DOI',
        loaderData?.site.title,
        branding.title,
      ),
    },
  ];
};

type SubmissionDoiRouteProps = {
  loaderData: SubmissionDoiPageData;
};

export default function SubmissionDoiRoute({ loaderData }: SubmissionDoiRouteProps) {
  const { site, submission, state } = loaderData;
  const breadcrumbs = [
    { label: 'Sites', href: '/app/sites' },
    { label: site.title, href: `/app/sites/${site.name}/inbox` },
    { label: 'Submissions', href: `/app/sites/${site.name}/submissions` },
    { label: submission.title, href: `/app/sites/${site.name}/submissions/${submission.id}` },
    { label: 'DOI', isCurrentPage: true },
  ];
  return (
    <PageFrame breadcrumbs={breadcrumbs}>
      <div className="flex flex-col max-w-4xl mt-4 space-y-5">
        {state.kind === 'not_configured' && (
          <ui.SimpleAlert
            type="error"
            message="DOI registration is not configured on this deployment. Ask a Curvenote engineer to set api.crossref."
          />
        )}
        <DoiReadinessCard state={state} />
        {state.kind === 'assembled' && state.xml && (
          <DoiPreviewCard submissionId={submission.id} doi={state.doi} xml={state.xml} />
        )}
      </div>
    </PageFrame>
  );
}
