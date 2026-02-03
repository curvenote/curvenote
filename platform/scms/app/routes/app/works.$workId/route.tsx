import type { Route } from './+types/route';
import { redirect, type LoaderFunctionArgs } from 'react-router';
import { Outlet } from 'react-router';
import { withSecureWorkContext } from '@curvenote/scms-server';
import {
  MainWrapper,
  SecondaryNav,
  getBrandingFromMetaMatches,
  joinPageTitle,
  TrackEvent,
  getWorkflows,
  registerExtensionWorkflows,
  scopes,
} from '@curvenote/scms-core';
import { buildMenu } from './menu';
import { dbGetWorkVersionsWithSubmissionVersions } from './db.server';
import { WorkDetailsCard } from './WorkDetailsCard';
import { getUniqueSubmissions } from './utils.server';
import { extensions } from '../../../extensions/client';

export const loader = async (args: LoaderFunctionArgs) => {
  const ctx = await withSecureWorkContext(args, [scopes.work.read]);

  const { workId } = args.params;
  if (!workId) return redirect('/app/works');

  const workVersions = await dbGetWorkVersionsWithSubmissionVersions(ctx.work.id);
  if (!workVersions) throw redirect('/app/works');

  const isDraftOnlyWork = workVersions.length > 0 && workVersions.every((v) => v.draft);

  const url = new URL(args.request.url);
  const pathname = url.pathname;

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

  // Default index redirect.
  if (pathname === `/app/works/${workId}` || pathname === `/app/works/${workId}/`) {
    throw redirect(`/app/works/${workId}/details`);
  }

  const submissions = getUniqueSubmissions(workVersions);
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
