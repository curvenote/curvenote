import type { Route } from './+types/route';
import { withAppScopedContext } from '@curvenote/scms-server';
import {
  scopes,
  MainWrapper,
  PageFrame,
  FrameHeader,
  getBrandingFromMetaMatches,
  joinPageTitle,
} from '@curvenote/scms-core';
import type { LoaderFunctionArgs } from 'react-router';
import { Link } from 'react-router';
import { dbGetDraftWorks } from './db.server';
import type { DraftWorkItem } from './db.server';
import { FileEdit } from 'lucide-react';

export const loader = async (args: LoaderFunctionArgs) => {
  const ctx = await withAppScopedContext(args, [scopes.work.list]);
  try {
    const items = await dbGetDraftWorks(ctx.user.id);
    return { items };
  } catch {
    return { items: [] };
  }
};

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Draft Works', branding.title) }];
};

const DETAILS_WITH_DRAFTS = '?drafts=true';

function DraftWorkRow({ work }: { work: DraftWorkItem }) {
  const version = work.versions[0];
  const title = version?.title ?? 'Untitled Work';
  const isWorkVersionDraft = work.draftKind === 'work_version_draft';
  const href =
    isWorkVersionDraft && version
      ? `/app/works/${work.id}/upload/${version.id}?from=drafts`
      : `/app/works/${work.id}/details${DETAILS_WITH_DRAFTS}`;

  return (
    <div className="flex gap-4 justify-between items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <div className="flex-1 min-w-0">
        <Link
          to={href}
          className="font-medium text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
        >
          {title}
        </Link>
        <div className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          {isWorkVersionDraft ? (
            <span>Draft work version — resume upload</span>
          ) : (
            <span>Draft submission — 1 submission (DRAFT)</span>
          )}
        </div>
      </div>
      <Link
        to={href}
        className="shrink-0 rounded border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        {isWorkVersionDraft ? 'Resume' : 'View'}
      </Link>
    </div>
  );
}

export default function DraftWorksPage({ loaderData }: Route.ComponentProps) {
  const { items } = loaderData;

  return (
    <MainWrapper>
      <PageFrame
        header={
          <FrameHeader
            className="max-w-4xl"
            title="Draft Works"
            subtitle="Works excluded from My Works: draft work versions and works with only draft submissions."
          />
        }
        hasSecondaryNav={false}
        className="max-w-[900px]"
      >
        {items.length === 0 ? (
          <div className="flex flex-col gap-2 justify-center items-center py-12 text-gray-500 dark:text-gray-400">
            <FileEdit className="w-10 h-10" />
            <p>No draft works.</p>
            <Link to="/app/works" className="text-blue-600 hover:underline dark:text-blue-400">
              Back to My Works
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900">
            {items.map((work: DraftWorkItem) => (
              <DraftWorkRow key={work.id} work={work} />
            ))}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 dark:border-gray-700 dark:bg-gray-800/50">
              <Link
                to="/app/works"
                className="text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                ← Back to My Works
              </Link>
            </div>
          </div>
        )}
      </PageFrame>
    </MainWrapper>
  );
}
