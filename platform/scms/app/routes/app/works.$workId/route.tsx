import type { Route } from './+types/route';
import { redirect, type LoaderFunctionArgs } from 'react-router';
import { Outlet } from 'react-router';
import {
  MainWrapper,
  SecondaryNav,
  getBrandingFromMetaMatches,
  joinPageTitle,
} from '@curvenote/scms-core';
import { buildMenu } from './menu';
import { WorkDetailsCard } from './WorkDetailsCard';
import { extensions } from '../../../extensions/client';
import { workLayoutLoader } from './workLayoutLoader.server';

export const loader = async (args: LoaderFunctionArgs) => {
  const data = await workLayoutLoader(args);
  const { workId } = args.params;
  const url = new URL(args.request.url);
  const pathname = url.pathname;
  const includeDraftSubmissions = url.searchParams.get('drafts') === 'true';

  // Draft-only works should route users into the upload flow, not the details pages.
  if (isDraftOnlyWork) {
    const isUploadPath = pathname.includes(`/app/works/${workId}/upload/`);
    const isDetailsLikePath =
      pathname === `/app/works/${workId}` ||
      pathname === `/app/works/${workId}/` ||
      pathname.startsWith(`/app/works/${workId}/details`) ||
      pathname.startsWith(`/app/works/${workId}/users`) ||
      pathname.startsWith(`/app/works/${workId}/checks`) ||
      pathname.startsWith(`/app/works/${workId}/site/`);

    if (!isUploadPath && isDetailsLikePath) {
      throw redirect(`/app/works/${workId}/upload/${workVersions[0].id}`);
    }
  }

  // Default index redirect (preserve query string e.g. ?drafts=true).
  // Default index redirect for main work layout only.
  if (pathname === `/app/works/${workId}` || pathname === `/app/works/${workId}/`) {
    throw redirect(`/app/works/${workId}/details${url.search}`);
  }

  const submissions = getUniqueSubmissions(workVersions, {
    includeDrafts: includeDraftSubmissions,
  });
  const workflowNames = submissions.map((s) => s.collection.workflow);

  // TODO we could filter workflows based on the work versions
  const workflows = Object.fromEntries(
    Object.entries(getWorkflows(ctx.$config, registerExtensionWorkflows(extensions))).filter(
      ([name]) => workflowNames.includes(name),
    ),
  );

  await ctx.trackEvent(TrackEvent.WORK_VIEWED, {
    workId: ctx.work.id,
    workTitle: ctx.workDTO.title,
    versionCount: workVersions.length,
    submissionCount: submissions.length,
    isDraft: workVersions.length === 1 && workVersions[0].draft,
  });

  await ctx.analytics.flush();

  return {
    userScopes: ctx.scopes,
    workflows,
    work: ctx.workDTO,
    versions: workVersions ?? [],
    submissions: submissions ?? [],
  };
};

export const meta: Route.MetaFunction = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle(loaderData?.work?.title, 'Work Details', branding.title) }];
};

export default function WorkLayout({ loaderData }: Route.ComponentProps) {
  const { work, versions, submissions, userScopes } = loaderData;

  const isDrafting = versions.length > 0 && versions.every((v) => v.draft);
  const menu = buildMenu(`/app/works/${work.id}`, isDrafting, submissions, userScopes);

  return (
    <>
      {!isDrafting && (
        <SecondaryNav
          contents={menu}
          title={isDrafting ? 'Work Details' : undefined}
          extensions={extensions}
          detailsCard={
            !isDrafting ? (
              <WorkDetailsCard
                title={work.title ?? ''}
                authors={work.authors}
                thumbnail={work.links.thumbnail}
              />
            ) : undefined
          }
        />
      )}
      <MainWrapper hasSecondaryNav={!isDrafting}>
        <Outlet />
      </MainWrapper>
    </>
  );
}
