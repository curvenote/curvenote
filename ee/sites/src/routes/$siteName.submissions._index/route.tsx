import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { withAppSiteContext } from '@curvenote/scms-server';
import {
  PageFrame,
  getBrandingFromMetaMatches,
  joinPageTitle,
  site as siteScopes,
} from '@curvenote/scms-core';
import { z } from 'zod';
import { dbCountSubmissionsForIndex, dbListSubmissionsForIndex } from './db.server.js';
import { formatSubmissionsIndexItems } from './format.server.js';
import { formatSubmissionListingSiteContext } from '../$siteName.submissions-classic/site-context.format.server.js';
import type { SubmissionListingSiteContext } from '../$siteName.submissions-classic/site-context.format.server.js';
import { ClassicSubmissionsRedirect } from './ClassicSubmissionsRedirect.js';
import { SubmissionsListingToolbar } from './SubmissionsListingToolbar.js';
import { SubmissionsList } from './SubmissionsList.js';
import {
  DEFAULT_SUBMISSIONS_PER_PAGE,
  SUBMISSIONS_PER_PAGE_OPTIONS,
  SubmissionsPagination,
} from './SubmissionsPagination.js';
import type { SubmissionsIndexPage } from './types.js';

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce
    .number()
    .int()
    .default(DEFAULT_SUBMISSIONS_PER_PAGE)
    .transform((value) =>
      (SUBMISSIONS_PER_PAGE_OPTIONS as readonly number[]).includes(value)
        ? value
        : DEFAULT_SUBMISSIONS_PER_PAGE,
    ),
});

interface LoaderData {
  site: SubmissionListingSiteContext;
  submissions: SubmissionsIndexPage;
}

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const ctx = await withAppSiteContext(args, [siteScopes.submissions.list], {
    redirectTo: '/app',
    redirect: true,
  });

  const url = new URL(args.request.url);
  const { page, perPage } = PaginationSchema.parse(Object.fromEntries(url.searchParams));

  const [rows, total] = await Promise.all([
    dbListSubmissionsForIndex(ctx, { page, perPage }),
    dbCountSubmissionsForIndex(ctx),
  ]);

  return {
    site: formatSubmissionListingSiteContext(ctx),
    submissions: {
      items: formatSubmissionsIndexItems(rows),
      page,
      perPage,
      total,
    },
  };
}

export const meta: MetaFunction<typeof loader> = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Submissions', loaderData?.site?.title, branding.title) }];
};

export default function Submissions({ loaderData }: { loaderData: LoaderData }) {
  const { site, submissions } = loaderData;

  const breadcrumbs = [
    { label: 'Sites', href: '/app/sites' },
    { label: site.title || site.name, isCurrentPage: true },
  ];

  return (
    <PageFrame
      title="All Submissions"
      subtitle={<span>List, filter, search and view all submissions.</span>}
      breadcrumbs={breadcrumbs}
    >
      <SubmissionsListingToolbar className="mb-5" />
      <div className="flex flex-col gap-2">
        <SubmissionsPagination
          page={submissions.page}
          perPage={submissions.perPage}
          total={submissions.total}
        />
        <SubmissionsList siteName={site.name} items={submissions.items} />
        <SubmissionsPagination
          page={submissions.page}
          perPage={submissions.perPage}
          total={submissions.total}
        />
      </div>
      <ClassicSubmissionsRedirect siteName={site.name} />
    </PageFrame>
  );
}
