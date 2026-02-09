import { redirect, type LoaderFunctionArgs } from 'react-router';
import { withSecureWorkContext } from '@curvenote/scms-server';
import { TrackEvent, getWorkflows, registerExtensionWorkflows, scopes } from '@curvenote/scms-core';
import { dbGetWorkVersionsWithSubmissionVersions } from './db.server';
import { getUniqueSubmissions } from './utils.server';
import { extensions } from '../../../extensions/client';

/** Shared loader data for work layout and v3 work details. Used by works.$workId and works.v3.$workId. */
export async function workLayoutLoader(args: LoaderFunctionArgs) {
  const ctx = await withSecureWorkContext(args, [scopes.work.read]);

  const { workId } = args.params;
  if (!workId) return redirect('/app/works');

  const workVersions = await dbGetWorkVersionsWithSubmissionVersions(ctx.work.id);
  if (!workVersions) throw redirect('/app/works');

  const isDraftOnlyWork = workVersions.length > 0 && workVersions.every((v) => v.draft);

  const url = new URL(args.request.url);
  const pathname = url.pathname;

  // Draft-only works should route users into the upload flow, not the details pages.
  const isUploadPath = pathname.includes(`/app/works/${workId}/upload/`);
  const isDetailsLikePath =
    pathname === `/app/works/${workId}` ||
    pathname === `/app/works/${workId}/` ||
    pathname.startsWith(`/app/works/${workId}/details`) ||
    pathname.startsWith(`/app/works/${workId}/users`) ||
    pathname.startsWith(`/app/works/${workId}/checks`) ||
    pathname.startsWith(`/app/works/${workId}/site/`) ||
    pathname === `/app/works/v3/${workId}`;

  if (isDraftOnlyWork && !isUploadPath && isDetailsLikePath) {
    throw redirect(`/app/works/${workId}/upload/${workVersions[0].id}`);
  }

  const submissions = getUniqueSubmissions(workVersions);
  const workflowNames = submissions.map((s) => s.collection.workflow);

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
}
