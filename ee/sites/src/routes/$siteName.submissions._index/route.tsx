import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { useFetcher, useNavigate, useSearchParams, data } from 'react-router';
import { withAppSiteContext, sites } from '@curvenote/scms-server';
import {
  PageFrame,
  formatZodError,
  site as siteScopes,
  getBrandingFromMetaMatches,
  joinPageTitle,
  useInfiniteScroll,
} from '@curvenote/scms-core';
import type { Prisma } from '@prisma/client';
import { useEffect, useState, useCallback } from 'react';
import { zfd } from 'zod-form-data';
import { z } from 'zod';
import { dbListSignedSubmissions, dbQueryJobs } from './db.server.js';
import type { AugmentedSubmissionsListWithPagination } from './types.js';
import { CollectionSelect } from './CollectionSelect.js';
import { SiteTrackEvent } from '../../analytics/events.js';
import { SubmissionList } from '../../components/SubmissionList.js';
import type { CollectionSummaryDTO, SiteDTO } from '@curvenote/common';

interface LoaderData {
  scopes: string[];
  site: SiteDTO;
  submissions: AugmentedSubmissionsListWithPagination;
  collections: CollectionSummaryDTO[];
  defaultCollectionOnly: boolean;
}

type SubmissionWithJob = AugmentedSubmissionsListWithPagination['items'][number];

const SubmissionListingSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
  collection: z.string().optional(),
});

const SubmissionListingFormSchema = zfd.formData({
  intent: zfd.text(z.enum(['scroll', 'filter-collection'])),
  collection: zfd.text(z.string()).optional(),
  page: zfd.text(z.coerce.number().int().positive()).optional(),
  perPage: zfd.text(z.coerce.number().int().positive()).optional(),
});

const DEFAULT_PER_PAGE = 30;

export const loader = async (args: LoaderFunctionArgs): Promise<LoaderData> => {
  const ctx = await withAppSiteContext(args, [siteScopes.submissions.list], {
    redirectTo: '/app',
    redirect: true,
  });

  const url = new URL(args.request.url);
  const params = Object.fromEntries(url.searchParams);
  const { perPage, collection } = SubmissionListingSchema.parse(params);

  const where: Prisma.SubmissionWhereInput = {};
  if (collection) {
    where.collection = { name: collection };
  }

  // TODO can defer jobs, need to have suspense/await on the ui to handle that
  const submissions = await dbListSignedSubmissions(ctx, where, 1, perPage ?? DEFAULT_PER_PAGE);

  // Get user's role on this site
  const userSiteRole =
    ctx.user?.site_roles.find((sr) => sr.site_id === ctx.site.id)?.role || 'none';

  await ctx.trackEvent(SiteTrackEvent.SITE_VIEWED, {
    siteName: ctx.site.name,
    siteType: ctx.site.private ? 'private' : 'public',
    userRole: userSiteRole,
    submissionCount: submissions.total,
    pageType: 'submissions_list',
    collectionFilter: collection || 'all',
  });

  await ctx.analytics.flush();

  return {
    scopes: ctx.scopes,
    site: ctx.siteDTO,
    submissions,
    collections: ctx.site.collections.map((c) => sites.collections.formatCollectionSummaryDTO(c)),
    defaultCollectionOnly: ctx.site.collections.length === 1 && ctx.site.collections[0].default,
  };
};

export const meta: MetaFunction<typeof loader> = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Submissions', loaderData?.site?.title, branding.title) }];
};

export function shouldRevalidate() {
  return false;
}

export const action = async (args: ActionFunctionArgs) => {
  const ctx = await withAppSiteContext(args, [siteScopes.submissions.update]);

  const where: Prisma.SubmissionWhereInput = {};

  let page: number | undefined;
  let perPage: number | undefined;
  let intent: 'scroll' | 'filter-collection' = 'scroll';
  try {
    const formData = await ctx.request.formData();
    const payload = SubmissionListingFormSchema.parse(formData);
    if (payload.collection !== 'all') {
      where.collection = { name: payload.collection };
    }
    page = payload.page;
    perPage = payload.perPage;
    intent = payload.intent;
  } catch (e: any) {
    console.error(`Invalid form data ${e}`);
    console.error(e);
    return data({ error: formatZodError(e) }, { status: 400 });
  }

  const [submissions, jobs] = await Promise.all([
    dbListSignedSubmissions(ctx, where, page, perPage ?? DEFAULT_PER_PAGE),
    dbQueryJobs(ctx),
  ]);

  submissions.items = submissions.items.map((s: SubmissionWithJob) => {
    const job = jobs.items?.find((j) => (j.payload as any).submission_version_id === s.version_id);
    return {
      ...s,
      job,
    };
  });

  if (intent === 'filter-collection') {
    return data({ submissions, jobs, page: perPage ? 1 : undefined, perPage, reload: true });
  }

  // else intent == 'scroll'
  return data({ submissions, jobs, page, perPage });
};

export default function AllSubmissionsPage({ loaderData }: { loaderData: LoaderData }) {
  const { scopes, site, submissions, collections, defaultCollectionOnly } = loaderData;

  const navigate = useNavigate();
  const [urlSearchParams] = useSearchParams();
  const [items, setItems] = useState<AugmentedSubmissionsListWithPagination['items']>(
    submissions.items,
  );

  const fetcher = useFetcher<{
    submissions?: AugmentedSubmissionsListWithPagination;
    error?: string;
    reload: boolean;
  }>();

  const hasNextPage = fetcher.data?.submissions
    ? (fetcher.data.submissions.hasMore ?? false)
    : (submissions.hasMore ?? false);

  const handleLoadMore = useCallback(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined;
    const perPage = searchParams.get('perPage')
      ? parseInt(searchParams.get('perPage')!)
      : undefined;

    if (page === undefined || perPage === undefined) {
      return;
    }

    const formData = new FormData();
    formData.append('intent', 'scroll');
    formData.append('page', (page + 1).toString());
    if (fetcher.data?.submissions?.perPage) {
      formData.append('perPage', fetcher.data.submissions.perPage.toString());
    } else {
      formData.append('perPage', DEFAULT_PER_PAGE.toString());
    }
    formData.append('collection', urlSearchParams.get('collection') ?? 'all');

    fetcher.submit(formData, { method: 'post' });
  }, [fetcher, urlSearchParams]);

  const { infiniteRef, rootRef } = useInfiniteScroll({
    loading: fetcher.state !== 'idle',
    hasNextPage,
    onLoadMore: handleLoadMore,
  });

  // Update URL with pagination parameters when they are defined
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    let hasChanges = false;

    if (fetcher.data?.submissions?.page !== undefined || submissions.page !== undefined) {
      const page = fetcher.data?.submissions?.page ?? submissions.page;
      searchParams.set('page', page!.toString());
      hasChanges = true;
    }
    if (fetcher.data?.submissions?.perPage !== undefined || submissions.perPage !== undefined) {
      const perPage = fetcher.data?.submissions?.perPage ?? submissions.perPage;
      searchParams.set('perPage', perPage!.toString());
      hasChanges = true;
    }

    if (hasChanges) {
      navigate(`?${searchParams.toString()}`, { replace: true });
    }
  }, [navigate, submissions.page, submissions.perPage, fetcher.data]);

  useEffect(() => {
    if (fetcher.data?.submissions?.items) {
      // Type assertion to handle the serialized data
      const newItems = fetcher.data.submissions
        .items as AugmentedSubmissionsListWithPagination['items'];

      setItems((prev) => {
        if (fetcher.data?.reload) {
          return newItems;
        }
        return [...prev, ...newItems];
      });
    }
  }, [fetcher.data]);

  const breadcrumbs = [
    { label: 'Sites', href: '/app/sites' },
    { label: site.title || site.name, href: `/app/sites/${site.name}/inbox` },
    { label: 'Submissions', isCurrentPage: true },
  ];

  return (
    <PageFrame
      ref={rootRef}
      className="overflow-y-scroll relative h-screen"
      title="Submitted Articles"
      subtitle={`List and view all article submissions for ${site.title}`}
      breadcrumbs={breadcrumbs}
    >
      {!defaultCollectionOnly && (
        <CollectionSelect
          fetcher={fetcher as any}
          collections={collections}
          defaultValue={urlSearchParams.get('collection') ?? 'all'}
        />
      )}
      {items.length === 0 && <div className="mt-8 font-medium">No submitted articles found</div>}
      {items.length > 0 && (
        <div className="flex overflow-y-scroll flex-col gap-4 w-full sm:gap-2">
          <SubmissionList
            scopes={scopes}
            site={site}
            items={items as AugmentedSubmissionsListWithPagination['items']}
            to={(id: string) => id}
            revalidate={() => false}
            showCollectionChip={!defaultCollectionOnly}
          />
        </div>
      )}
      {hasNextPage && (
        <div ref={infiniteRef} className="flex justify-center items-center">
          <div className="text-sm text-gray-500 animate-pulse">Loading more...</div>
        </div>
      )}
    </PageFrame>
  );
}
