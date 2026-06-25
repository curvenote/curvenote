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
import { formatSiteLayoutSite } from '../$siteName/layout.format.server.js';
import type { SiteLayoutSite } from '../$siteName/layout.format.server.js';
import { SubmissionsListingToolbar } from './SubmissionsListingToolbar.js';
import { SubmissionsList } from './SubmissionsList.js';
import {
  DEFAULT_SUBMISSIONS_PER_PAGE,
  SUBMISSIONS_PER_PAGE_OPTIONS,
  SubmissionsPagination,
} from './SubmissionsPagination.js';
import type { SubmissionsIndexPage } from './types.js';
import {
  LISTING_SEARCH_MIN_LENGTH,
  LISTING_SORTS,
  LISTING_SORT_DEFAULT,
  LISTING_SORTS_AWAITING_DENORMALISATION,
  LISTING_STATUS_IDS,
  type ListingQuery,
  type ListingSort,
} from './listingParams.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Search-query preprocessor. Trims whitespace and drops the value entirely if
 * the trimmed length is below `LISTING_SEARCH_MIN_LENGTH` (3) — see the
 * comment by that constant for the rationale. The search input also enforces
 * this floor before pushing to the URL, but we re-check here as defense in
 * depth in case someone hand-crafts or bookmarks a `?q=ab` URL.
 */
const searchQuery = z.preprocess((v) => {
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  if (trimmed.length < LISTING_SEARCH_MIN_LENGTH) return undefined;
  return trimmed;
}, z.string().min(LISTING_SEARCH_MIN_LENGTH).max(200).optional());

const csvIds = z.preprocess(
  (v) => (typeof v === 'string' ? v : undefined),
  z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',').filter(Boolean) : [])),
);

const optionalDateString = z.preprocess(
  (v) => (typeof v === 'string' && ISO_DATE.test(v) ? v : undefined),
  z.string().optional(),
);

/**
 * Boolean URL param. Only `?unpublishedOnly=1` flips this on — any other
 * value (including `true`, `0`, empty, missing) is treated as false. Keeps
 * the URL contract trivial and the boolean comparison side-effect free.
 */
const boolFlag = z.preprocess((v) => v === '1', z.boolean());

const csvStatusIds = z.preprocess(
  (v) => (typeof v === 'string' ? v : undefined),
  z
    .string()
    .optional()
    .transform((s) =>
      s
        ? s
            .split(',')
            .filter(Boolean)
            .filter((id) => LISTING_STATUS_IDS.has(id))
        : [],
    ),
);

/**
 * Canonical URL contract for the submissions index listing.
 *
 *   page, perPage  — pagination
 *   q              — search text (matches title / authors / DOI); committed on Enter or blur
 *   sort           — one of LISTING_SORTS; disabled values silently coerce
 *                    to the default until the denormalisation slice lands
 *   kindIds        — CSV of SubmissionKind ids (multi-select chip)
 *   collectionIds  — CSV of Collection ids (multi-select chip)
 *   statuses       — CSV of newest-version statuses (LISTING_STATUS_OPTIONS).
 *                    Unknown ids are dropped silently so links survive enum
 *                    additions/removals.
 *   from, to       — ISO yyyy-mm-dd window applied strictly to date_published.
 *                    Submissions whose date_published is NULL are excluded
 *                    when any window is active.
 *   unpublishedOnly  `?unpublishedOnly=1` returns only submissions with
 *                    date_published IS NULL. Mutually exclusive with
 *                    `from` / `to` (any range is ignored when set).
 */
const ListingQuerySchema = z.object({
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
  q: searchQuery,
  sort: z
    .enum(LISTING_SORTS)
    .catch(LISTING_SORT_DEFAULT)
    .default(LISTING_SORT_DEFAULT)
    .transform(
      (value): ListingSort =>
        LISTING_SORTS_AWAITING_DENORMALISATION.has(value) ? LISTING_SORT_DEFAULT : value,
    ),
  kindIds: csvIds,
  collectionIds: csvIds,
  statuses: csvStatusIds,
  from: optionalDateString,
  to: optionalDateString,
  unpublishedOnly: boolFlag,
});

// Compile-time check that the schema produces a value assignable to the
// canonical ListingQuery shape (defined in listingParams.ts so the type stays
// free of the zod dep and reusable from client components).
type SchemaListingQuery = z.infer<typeof ListingQuerySchema>;
const _assertListingQueryShape: SchemaListingQuery extends ListingQuery ? true : false = true;
void _assertListingQueryShape;

export interface ToolbarKindOption {
  id: string;
  name: string;
}

export interface ToolbarCollectionOption {
  id: string;
  name: string;
  default: boolean;
}

interface LoaderData {
  site: SiteLayoutSite;
  submissions: SubmissionsIndexPage;
  defaultCollectionOnly: boolean;
  singleKindOnly: boolean;
  availableKinds: ToolbarKindOption[];
  availableCollections: ToolbarCollectionOption[];
}

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const ctx = await withAppSiteContext(args, [siteScopes.submissions.list], {
    redirectTo: '/app',
    redirect: true,
  });

  const url = new URL(args.request.url);
  const query = ListingQuerySchema.parse(Object.fromEntries(url.searchParams));

  const [rows, total] = await Promise.all([
    dbListSubmissionsForIndex(ctx, query),
    dbCountSubmissionsForIndex(ctx, query),
  ]);

  const availableKinds: ToolbarKindOption[] = (ctx.site.submissionKinds ?? []).map((kind) => ({
    id: kind.id,
    name: kind.name,
  }));
  const availableCollections: ToolbarCollectionOption[] = (ctx.site.collections ?? []).map(
    (collection) => ({
      id: collection.id,
      name: collection.name,
      default: collection.default,
    }),
  );

  return {
    site: formatSiteLayoutSite(ctx),
    submissions: {
      items: formatSubmissionsIndexItems(ctx, rows),
      page: query.page,
      perPage: query.perPage,
      total,
    },
    defaultCollectionOnly: availableCollections.length === 1 && availableCollections[0].default,
    singleKindOnly: availableKinds.length === 1,
    availableKinds,
    availableCollections,
  };
}

export const meta: MetaFunction<typeof loader> = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Submissions', loaderData?.site?.title, branding.title) }];
};

export default function Submissions({ loaderData }: { loaderData: LoaderData }) {
  const {
    site,
    submissions,
    defaultCollectionOnly,
    singleKindOnly,
    availableKinds,
    availableCollections,
  } = loaderData;

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
      <SubmissionsListingToolbar
        className="mb-5"
        availableKinds={singleKindOnly ? [] : availableKinds}
        availableCollections={defaultCollectionOnly ? [] : availableCollections}
        totalResults={submissions.total}
      />
      <div className="flex flex-col gap-2">
        <SubmissionsPagination
          page={submissions.page}
          perPage={submissions.perPage}
          total={submissions.total}
        />
        <SubmissionsList
          siteName={site.name}
          items={submissions.items}
          showCollectionChip={!defaultCollectionOnly}
          showKindChip={!singleKindOnly}
        />
        <SubmissionsPagination
          page={submissions.page}
          perPage={submissions.perPage}
          total={submissions.total}
        />
      </div>
    </PageFrame>
  );
}
